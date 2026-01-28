import { Groq } from 'groq-sdk';
import { ConversationState, TripPreferences } from '../types';
import { PreferenceManager } from './preference-manager';

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

export class ConversationOrchestrator {
    private static SYSTEM_PROMPT = ` You are an expert travel planning orchestrator.
Your goal is to extract trip preferences from the user's message.
The supported cities are: Jaipur, Bengaluru, Goa.
Trip duration must be between 1 and 3 days.
Pace can be: relaxed, balanced, packed.

Current Preferences: {current_prefs}

If the user provides new information, update the preferences.
If the information is invalid (e.g., unsupported city), explain why.
Respond ONLY with a JSON object in the following format:
{
  "updated_preferences": { ... },
  "clarification_question": "string or null",
  "intent": "collect_info" | "generate_itinerary" | "edit_itinerary",
  "reasoning": "short explanation"
}
`;

    static async processMessage(
        message: string,
        currentState: ConversationState
    ): Promise<ConversationState> {
        // 1. Prepare history for the model
        const history = [...currentState.history, { role: 'user' as const, content: message }];

        // 2. Call Groq to parse intent and extract data
        const response = await groq.chat.completions.create({
            messages: [
                {
                    role: 'system',
                    content: this.SYSTEM_PROMPT.replace('{current_prefs}', JSON.stringify(currentState.preferences))
                },
                ...history,
            ],
            model: 'llama-3.3-70b-versatile',
            response_format: { type: 'json_object' },
        });

        const result = JSON.parse(response.choices[0].message.content || '{}');

        // 3. Update preferences
        const updatedPrefs = { ...currentState.preferences, ...result.updated_preferences };
        const validation = PreferenceManager.validate(updatedPrefs);

        let nextStatus = currentState.status;
        let clarificationQuestion = result.clarification_question;
        let turnCount = currentState.clarification_count;

        // 4. Manage turns and status
        if (validation.valid) {
            if (currentState.status === 'collecting_preferences') {
                nextStatus = 'confirmed';
                clarificationQuestion = "I have all your preferences! Shall I proceed with generating your itinerary for " + updatedPrefs.city + "?";
            }
        } else {
            turnCount++;
            if (turnCount >= 6) {
                clarificationQuestion = "I'm having trouble getting all the details. Let's try starting with just the city. Which of these would you like to visit: Jaipur, Bengaluru, or Goa?";
            }
        }

        const nextState: ConversationState = {
            ...currentState,
            preferences: updatedPrefs,
            status: nextStatus as any,
            clarification_count: turnCount,
            history: [...history, { role: 'assistant', content: clarificationQuestion || "Understood." }],
        };

        return nextState;
    }
}
