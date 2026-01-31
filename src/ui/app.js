
const chatMessages = document.getElementById('chat-messages');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const itineraryDisplay = document.getElementById('itinerary-display');
const statusText = document.getElementById('status-text');

// Voice Elements
const voiceToggle = document.getElementById('voice-toggle');
const micBtn = document.getElementById('mic-btn');

let sessionId = 'session-' + Math.random().toString(36).substr(2, 9);
let currentItineraryData = null;

// Voice State
let isVoiceMode = false;
let mediaRecorder;
let audioChunks = [];
let isRecording = false;
const synthesis = window.speechSynthesis;

// ---------------------------------------------------------
//  INIT
// ---------------------------------------------------------
// Initialize State
micBtn.style.display = 'none'; // Force hide initially

// ---------------------------------------------------------
//  VOICE LOGIC
// ---------------------------------------------------------

voiceToggle.addEventListener('change', (e) => {
    isVoiceMode = e.target.checked;
    if (isVoiceMode) {
        micBtn.style.display = 'block'; // Direct style manipulation
        micBtn.classList.add('animate-up');
        addMessage("🎙️ Voice Mode Enabled. Click the mic or speak.", false);
    } else {
        micBtn.style.display = 'none';
        synthesis.cancel(); // Stop speaking
        stopRecording();
    }
});

micBtn.addEventListener('click', () => {
    if (!isRecording) startRecording();
    else stopRecording();
});

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = e => audioChunks.push(e.data);

        mediaRecorder.onstop = () => {
            // Process when specific stop event fires
            processAudio();
            // Stop all tracks to release mic
            stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();

        isRecording = true;
        micBtn.classList.add('listening');
        micBtn.innerHTML = '⏹️'; // Visual cue to stop
        userInput.placeholder = "Listening... (Click mic to stop)";
        statusText.innerText = 'Listening...';

    } catch (err) {
        console.error("Mic Error:", err);
        alert("Could not access microphone. Please allow permissions.");
    }
}

function stopRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        isRecording = false;
        micBtn.classList.remove('listening');
        micBtn.classList.add('processing');
        micBtn.innerHTML = '⏳';
        statusText.innerText = 'Processing voice...';
    }
}

async function processAudio() {
    // Default to webm if wav fails, but let's stick to consistent type
    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
    const formData = new FormData();
    formData.append('audio', audioBlob, 'input.webm'); // Send as webm, server can handle or rename

    try {
        const res = await fetch('/api/transcribe', { method: 'POST', body: formData });

        if (!res.ok) throw new Error("Transcription Failed");

        const data = await res.json();

        micBtn.classList.remove('processing');
        micBtn.innerHTML = '🎙️'; // Reset icon
        userInput.placeholder = "Type your message...";

        if (data.text && data.text.trim().length > 0) {
            userInput.value = data.text;
            // Visual feedback of transcript
            // Auto-send in voice mode
            sendMessage();
        } else {
            statusText.innerText = 'No speech detected';
        }
    } catch (err) {
        console.error(err);
        micBtn.classList.remove('processing');
        micBtn.innerHTML = '🎙️';
        statusText.innerText = 'Error processing voice';
    }
}

function speak(text) {
    if (!isVoiceMode || !text) return;
    const clean = text.replace(/[*#]/g, '').replace(/https?:\/\/\S+/g, 'link');
    const u = new SpeechSynthesisUtterance(clean);
    synthesis.speak(u);
}

// ---------------------------------------------------------
//  CHAT LOGIC
// ---------------------------------------------------------

function addMessage(text, isBot = true) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `msg ${isBot ? 'bot-msg' : 'user-msg'} animate-up`;

    // Check if HTML (allows formatted messages)
    if (text.includes('<') && text.includes('>')) {
        msgDiv.innerHTML = text;
    } else {
        msgDiv.innerHTML = `<p>${text}</p>`;
    }

    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function updatePreferenceTags(data) {
    const preferencesBar = document.getElementById('preferences-bar');
    const preferenceTags = document.getElementById('preference-tags');

    if (!data || !data.user_preferences) {
        if (!currentItineraryData && !data.user_preferences) {
            preferencesBar.classList.add('hidden');
            return;
        }
    }

    const prefs = data.user_preferences || {};
    let tagsHTML = '';

    const renderTag = (label, value, extraClass = '') => {
        const isPending = !value || value === 0 || value.length === 0;
        const displayValue = isPending ? '...' : value;
        const pendingClass = isPending ? 'pending-tag' : '';
        return `<div class="pref-tag ${extraClass} ${pendingClass}"><span class="tag-label">${label}</span><span class="tag-value">${displayValue}</span></div>`;
    };

    tagsHTML += renderTag('📍 City', prefs.city);
    const durationVal = prefs.trip_days ? `${prefs.trip_days} ${prefs.trip_days === 1 ? 'Day' : 'Days'}` : null;
    tagsHTML += renderTag('📅 Duration', durationVal);
    tagsHTML += renderTag('⏰ Hours', prefs.daily_time_window, 'time-tag');

    if (prefs.interests && prefs.interests.length > 0) {
        prefs.interests.forEach(interest => {
            tagsHTML += `<div class="pref-tag interest-tag"><span class="tag-label">💡</span><span class="tag-value">${interest}</span></div>`;
        });
    } else {
        tagsHTML += renderTag('💡 Interests', null, 'interest-tag');
    }

    preferenceTags.innerHTML = tagsHTML;
    preferencesBar.classList.remove('hidden');
}

async function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return;

    addMessage(text, false);
    userInput.value = '';

    // Stop any existing speech
    if (isVoiceMode) synthesis.cancel();

    statusText.innerText = 'Thinking...';

    try {
        const response = await fetch('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, message: text })
        });

        const data = await response.json();
        const apiResponse = data.response;

        if (apiResponse && (apiResponse.user_preferences || apiResponse.state === 'READY_FOR_UI')) {
            updatePreferenceTags(apiResponse);
        }

        if (apiResponse.message) {
            let formattedMsg = apiResponse.message.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            formattedMsg = formattedMsg.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" class="download-link">$1</a>');
            formattedMsg = formattedMsg.replace(/\*Sources: (.*?)\*/g, '<br><em class="source-cite">Sources: $1</em>');
            addMessage(formattedMsg);

            speak(apiResponse.message);
        }
        else if (apiResponse.state === 'READY_FOR_UI') {
            const msg = "I've generated your itinerary! You can see it below.";
            addMessage(msg);
            speak(msg);
            renderItinerary(apiResponse);
            currentItineraryData = apiResponse;
        }
        else if (typeof apiResponse === 'string') {
            let formattedMsg = apiResponse.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            formattedMsg = formattedMsg.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" class="download-link">$1</a>');
            addMessage(formattedMsg);
            speak(apiResponse);
        }

        statusText.innerText = 'Ready';

    } catch (error) {
        console.error(error);
        addMessage("Sorry, I encountered an error. Please try again.");
        statusText.innerText = 'Error';
    }
}

function renderItinerary(data) {
    const poiMap = {};
    data.candidates.forEach(c => poiMap[c.poi_id] = c);

    itineraryDisplay.classList.remove('hidden');
    itineraryDisplay.innerHTML = `
        <div class="itinerary-header animate-up">
            <h2>Your Trip Itinerary</h2>
            <div class="badge-group">
                <span class="eval-badge ${data.evaluation_summary.feasibility === 'pass' ? 'badge-pass' : 'badge-fail'}">Feasibility: ${data.evaluation_summary.feasibility}</span>
                <span class="eval-badge ${data.evaluation_summary.grounding === 'pass' ? 'badge-pass' : 'badge-fail'}">Grounding: ${data.evaluation_summary.grounding}</span>
            </div>
        </div>

        <div class="itinerary-grid">
            <div class="days-column">
                ${data.itinerary.days.map(day => `
                    <div class="day-card animate-up">
                        <h3>Day ${day.day}</h3>
                        <div class="blocks">
                            ${day.blocks.map(block => {
        const poi = poiMap[block.poi_id] || { name: block.poi_id };
        return `
                                <div class="block">
                                    <div class="block-time">${block.time_of_day}</div>
                                    <div class="block-content">
                                        <strong>${poi.name}</strong><br>
                                        <p class="poi-desc">${poi.description || ''}</p>
                                        <div class="block-meta">
                                            <span>⏱️ ${block.duration_min}m</span>
                                            <span>🚗 ${block.travel_time_min}m</span>
                                            ${block.travel_distance_km ? `<span>📏 ${block.travel_distance_km}km</span>` : ''}
                                        </div>
                                    </div>
                                </div>
                                `;
    }).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>

        <div class="action-buttons">
            <button class="action-btn glass" onclick="exportPDF()">
                <span>📄</span> Export as PDF
            </button>
            <button class="action-btn glass" onclick="showEmailDialog()">
                <span>📧</span> Email Itinerary
            </button>
        </div>
    `;

    updatePreferenceTags(data);
    itineraryDisplay.scrollIntoView({ behavior: 'smooth' });
}

// ... global export/email functions (keeping same logic) ...
// (Re-declaring solely to ensure file completeness if overwriting completely)
async function exportPDF() {
    addMessage("Generating your PDF...", false);
    statusText.innerText = 'Generating PDF...';

    try {
        const response = await fetch('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, message: 'export pdf' })
        });

        const data = await response.json();
        addMessage(data.response);
        statusText.innerText = 'Ready';
        speak("PDF sent to your email.");
    } catch (error) {
        console.error(error);
        addMessage("Failed to generate PDF. Please try again.");
        statusText.innerText = 'Error';
    }
}

function showEmailDialog() {
    const dialog = document.getElementById('email-dialog');
    if (dialog) {
        dialog.classList.remove('hidden');
        const emailInput = document.getElementById('email-input');
        if (emailInput) setTimeout(() => emailInput.focus(), 100);
    }
}

function hideEmailDialog() {
    const dialog = document.getElementById('email-dialog');
    if (dialog) {
        dialog.classList.add('hidden');
        const emailInput = document.getElementById('email-input');
        if (emailInput) emailInput.value = '';
    }
}

async function sendEmail() {
    const emailInput = document.getElementById('email-input');
    const email = emailInput.value.trim();
    if (!email || !email.includes('@')) {
        alert('Please enter a valid email address');
        return;
    }
    hideEmailDialog();
    addMessage(`Sending itinerary to ${email}...`, false);
    statusText.innerText = 'Sending email...';

    try {
        const response = await fetch('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, message: `email to ${email}` })
        });
        const data = await response.json();
        addMessage(data.response);
        statusText.innerText = 'Ready';
        speak(`Sent to ${email}`);
    } catch (error) {
        console.error(error);
        addMessage("Failed to send email. Please check your email configuration.");
        statusText.innerText = 'Error';
    }
}

document.addEventListener('click', function (event) {
    const dialog = document.getElementById('email-dialog');
    if (dialog && !dialog.classList.contains('hidden')) {
        const dialogContent = document.querySelector('.email-dialog-content');
        if (dialogContent && !dialogContent.contains(event.target)) {
            if (event.target.classList.contains('email-dialog')) hideEmailDialog();
        }
    }
});

document.addEventListener('keypress', function (event) {
    if (event.key === 'Enter') {
        const emailInput = document.getElementById('email-input');
        if (emailInput && document.activeElement === emailInput) sendEmail();
    }
});

document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
        const dialog = document.getElementById('email-dialog');
        if (dialog && !dialog.classList.contains('hidden')) hideEmailDialog();
    }
});

sendBtn.addEventListener('click', sendMessage);
userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});
