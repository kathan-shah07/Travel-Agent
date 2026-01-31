
import { AgentState, Itinerary, UIReadyPayload, UserPreferences, POICandidate } from '../types';
import { PreferenceManager } from '../preference-manager/PreferenceManager';
import { ToolManager } from '../tool-manager/ToolManager';
import { EvaluationManager } from '../evaluation/EvaluationManager';
import { RAGManager } from '../rag/RAGManager';
import { ReasoningManager } from '../reasoning/ReasoningManager';

// Register Tools
import { PoiSearchTool } from '../mcp/poi-search';
import { ItineraryBuilderTool } from '../mcp/itinerary-builder';
import { WeatherTool } from '../mcp/weather';
import { TravelTimeTool } from '../mcp/travel-time';

// Utilities
import { PdfGenerator } from '../utils/PdfGenerator';
import { EmailService } from '../utils/EmailService';
import path from 'path';

export class TravelAgent {
    private state: AgentState = AgentState.COLLECTING_PREFERENCES;
    private preferences: UserPreferences;
    private currentItinerary: Itinerary | null = null;
    private previousItinerary: Itinerary | null = null;
    private lastUserMessage: string = "";
    private validCandidates: POICandidate[] = [];

    private prefManager: PreferenceManager;
    private toolManager: ToolManager;
    private evalManager: EvaluationManager;
    private ragManager: RAGManager;
    private reasoningManager: ReasoningManager;
    private pdfGenerator: PdfGenerator;
    private emailService: EmailService;

    constructor() {
        this.prefManager = new PreferenceManager();
        this.preferences = this.prefManager.getInitialPreferences();

        this.toolManager = new ToolManager();
        this.toolManager.registerTool(PoiSearchTool);
        this.toolManager.registerTool(ItineraryBuilderTool);
        this.toolManager.registerTool(WeatherTool);
        this.toolManager.registerTool(TravelTimeTool);

        this.evalManager = new EvaluationManager();
        this.ragManager = new RAGManager();
        this.reasoningManager = new ReasoningManager(this.ragManager); // RAG for grounded reasoning
        this.pdfGenerator = new PdfGenerator();
        this.emailService = new EmailService();
    }

    public async handleMessage(message: string): Promise<any> {
        this.lastUserMessage = message;

        // 1. If collecting preferences
        if (this.state === AgentState.COLLECTING_PREFERENCES) {
            // Caputure previous state to detect changes
            const prevPrefsJSON = JSON.stringify(this.preferences);

            // Update preferences based on message
            this.preferences = await this.prefManager.updatePreferences(this.preferences, message);

            // Detect if anything meaningful changed
            const newPrefsJSON = JSON.stringify(this.preferences);
            const hasChanges = prevPrefsJSON !== newPrefsJSON;

            const nextQ = this.prefManager.getNextQuestion(this.preferences);

            // Helper to return text with prefs
            const respond = (text: string) => ({
                message: text,
                user_preferences: this.preferences
            });

            // If no missing fields
            if (this.prefManager.getMissingFields(this.preferences).length === 0) {

                // If the user just changed a preference (e.g. "Actually make it 3 days"), 
                // confirm the change instead of auto-generating.
                if (hasChanges) {
                    return respond(`Got it! Updated your trip to ${this.preferences.trip_days} days in ${this.preferences.city}. Ready to generate?`);
                }

                // If no changes, check if it's a confirmation
                const lowerMsg = message.toLowerCase();
                const isConfirmation = lowerMsg.includes("yes") ||
                    lowerMsg.includes("generate") ||
                    lowerMsg.includes("proceed") ||
                    lowerMsg.includes("correct") ||
                    lowerMsg.includes("go ahead");

                if (isConfirmation) {
                    this.state = AgentState.GENERATING;
                    return this.generateItinerary();
                } else {
                    // We are ready but waiting for explicit confirmation
                    return respond("I have all details for " + this.preferences.city + ". Ready to generate the itinerary?");
                }
            }

            return respond(nextQ);
        }

        // 2. If already generated, check for reasoning request
        if (this.state === AgentState.READY_FOR_UI) {
            const req = message.toLowerCase();
            const respond = (text: string) => ({ message: text, user_preferences: this.preferences });

            if (req.includes("why") || req.includes("reason") || req.includes("justification") || req.includes("explain")) {
                const just = await this.generateJustifications(req);
                return respond(just);
            }
            if (req.includes("pdf") || req.includes("export")) {
                const pdfRes = await this.handlePdfExport(req);
                return respond(pdfRes);
            }
            if (req.includes("email")) {
                const emailRes = await this.handleEmailRequest(req);
                return respond(emailRes);
            }
            return respond("Your itinerary is ready. You can ask me 'Why?' to see the reasoning, 'Export PDF' to download it, or 'Email me' to receive it.");
        }

        return { message: "Handling not implemented for this state yet.", user_preferences: this.preferences };
    }

    private async generateJustifications(userQuery: string = ""): Promise<string> {
        console.log("[Orchestrator] Generating on-demand justifications...");
        if (!this.currentItinerary) return "No itinerary available to justify.";

        let allPoiNodes = this.currentItinerary.days.flatMap(d => d.blocks.map(b => {
            const candidate = this.validCandidates.find(c => c.poi_id === b.poi_id);
            return {
                poi_id: b.poi_id,
                name: candidate?.name || b.poi_id,
                description: candidate?.description,
                scheduled_time: b.time_of_day,
                duration_min: b.duration_min,
                travel_time_min: b.travel_time_min
            };
        }));

        // Filter if user asked about a specific POI
        const queryLower = userQuery.toLowerCase();
        const specificPoi = allPoiNodes.filter(p => {
            const poiNameLower = p.name.toLowerCase();
            // Check for exact match or if any significant word (len > 3) from POI name is in query
            const wordMatch = poiNameLower.split(' ').some(word => word.length > 3 && queryLower.includes(word));
            return queryLower.includes(poiNameLower) || wordMatch;
        });

        if (specificPoi.length > 0) {
            console.log(`[Orchestrator] Generating targeted justification for: ${specificPoi.map(p => p.name).join(', ')}`);
            allPoiNodes = specificPoi;
        }

        const justifications = await this.reasoningManager.justifyPOIs(
            allPoiNodes,
            this.preferences.city,
            this.preferences.interests,
            { daily_time_window: this.preferences.daily_time_window }
        );

        // Format as chat response
        if (justifications.length === 0) {
            return "I couldn't find that location in your itinerary. Could you rephrase your question?";
        }

        let response = "";
        justifications.forEach((j, idx) => {
            const poiName = allPoiNodes[idx]?.name || "This location";
            response += `**${poiName}:**\n${j.answer}\n`;
            if (j.citations && j.citations.length > 0) {
                response += `*Sources: ${j.citations.join(', ')}*\n`;
            }
            response += "\n";
        });

        return response.trim();
    }

    private async handlePdfExport(req: string): Promise<string> {
        if (!this.currentItinerary) return "No itinerary to export.";

        try {
            const fileName = `itinerary_${Date.now()}.pdf`;
            const filePath = path.join(process.cwd(), fileName);
            await this.pdfGenerator.generateItineraryPdf(this.currentItinerary, filePath);
            return `I've generated your PDF itinerary: ${filePath}`;
        } catch (error) {
            console.error("PDF Gen Error:", error);
            return "Sorry, I couldn't generate the PDF at this time.";
        }
    }

    private async handleEmailRequest(req: string): Promise<string> {
        if (!this.currentItinerary) return "No itinerary to email.";

        // Extract email address (simple regex)
        const emailMatch = req.match(/[\w\.-]+@[\w\.-]+\.\w+/);
        if (!emailMatch) {
            return "Please provide a valid email address (e.g., 'Email to test@example.com').";
        }

        const toEmail = emailMatch[0];
        const fileName = `itinerary_${Date.now()}.pdf`;
        const filePath = path.join(process.cwd(), fileName);

        try {
            await this.pdfGenerator.generateItineraryPdf(this.currentItinerary, filePath);
            const success = await this.emailService.sendItineraryEmail(toEmail, filePath);
            if (success) return `Email sent to ${toEmail}!`;
            else return "Failed to send email. Please check your system configuration.";
        } catch (e) {
            return "An error occurred while sending the email.";
        }
    }

    private async generateItinerary(): Promise<UIReadyPayload | string> {
        console.log("Starting Generation Flow...");

        try {
            // 1. POI Search
            const searchResult = await this.toolManager.executeTool('poi-search', {
                city: this.preferences.city,
                interests: this.preferences.interests
            });
            this.validCandidates = searchResult.candidates;

            // 2. RAG Ingestion
            console.log(`[Orchestrator] Triggering RAG Ingestion for ${this.preferences.city}...`);
            await this.ragManager.ingestCityData(this.preferences.city);

            // 3. Build Itinerary
            const topCandidates = [...this.validCandidates].sort((a, b) => b.score - a.score).slice(0, 20);
            const constructionResult = await this.toolManager.executeTool('itinerary-builder', {
                city: this.preferences.city,
                pois: topCandidates,
                interests: this.preferences.interests,
                daily_time_window: this.preferences.daily_time_window,
                pace: this.preferences.pace,
                trip_days: this.preferences.trip_days
            });

            // 3.1 Refine Travel Times (using TravelTimeTool)
            console.log("[Orchestrator] Refining travel times between blocks...");
            for (const day of constructionResult.days) {
                let previousBlock: any = null;

                for (const block of day.blocks) {
                    const currentPoi = this.validCandidates.find(c => c.poi_id === block.poi_id);

                    if (currentPoi) {
                        // Ensure Name is populated
                        if (!block.poi_name) block.poi_name = currentPoi.name;

                        if (previousBlock) {
                            const prevPoi = this.validCandidates.find(c => c.poi_id === previousBlock.poi_id);
                            if (prevPoi) {
                                try {
                                    const travel = await this.toolManager.executeTool('travel-time', {
                                        origin: prevPoi.location,
                                        destination: currentPoi.location,
                                        mode: 'driving'
                                    });
                                    block.travel_time_min = travel.travel_time_min;
                                    block.travel_distance_km = travel.distance_km;
                                } catch (err) {
                                    console.warn(`[Orchestrator] Travel time failed: ${err}`);
                                    block.travel_time_min = 15; // Fallback
                                    block.travel_distance_km = 2;
                                }
                            }
                        } else {
                            // First item of day - 0 travel from "hotel" (simplified)
                            block.travel_time_min = 0;
                            block.travel_distance_km = 0;
                        }
                    }
                    previousBlock = block;
                }
            }

            this.currentItinerary = constructionResult;

            // 3. Evaluate
            this.state = AgentState.EVALUATING;
            const evalResult = this.evalManager.evaluate(
                this.currentItinerary!,
                this.validCandidates,
                this.preferences,
                this.previousItinerary,
                this.lastUserMessage
            );

            // 4. Skip automatic reasoning (Moved to on-demand)
            // const justifications = await this.reasoningManager.justifyPOIs(allPoiNodes, this.preferences.city, this.preferences.interests);

            if (evalResult.overall_status === 'pass') {
                this.state = AgentState.READY_FOR_UI;
                this.previousItinerary = this.currentItinerary; // Save for next edit
                return {
                    state: this.state,
                    itinerary: this.currentItinerary!,
                    evaluation_summary: evalResult.details,
                    // justifications, // Now optional
                    candidates: this.validCandidates.map(c => ({
                        poi_id: c.poi_id,
                        name: c.name,
                        score: c.score,
                        description: c.description
                    })),
                    sources_available: true,
                    user_preferences: {
                        city: this.preferences.city,
                        trip_days: this.preferences.trip_days,
                        daily_time_window: this.preferences.daily_time_window,
                        interests: this.preferences.interests,
                        pace: this.preferences.pace
                    }
                };
            } else {
                // Handle failure (log and return message)
                console.error("[Orchestrator] Evaluation failed:", evalResult.details);
                return "Itinerary generation failed evaluation. The system detected ungrounded or unfeasible blocks. Please try adjusting your preferences.";
            }
        } catch (error: any) {
            console.error("[Orchestrator] Generation Flow failed:", error);
            console.error(error.stack);
            this.state = AgentState.COLLECTING_PREFERENCES; // Reset state so user can retry
            return `Generation failed: ${error.message}. Please check server logs.`;
        }
    }
}
