
const chatMessages = document.getElementById('chat-messages');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const itineraryDisplay = document.getElementById('itinerary-display');
const statusText = document.getElementById('status-text');
const micBtn = document.getElementById('mic-btn');

// Generate Unique Session ID per Tab load
let sessionId = localStorage.getItem('voice_session_id') || 'session-' + Math.random().toString(36).substr(2, 9);
localStorage.setItem('voice_session_id', sessionId);

// TTS
const synthesis = window.speechSynthesis;

// Voice State
let mediaRecorder;
let audioChunks = [];
let isRecording = false;

// ---------------------------------------------------------
//  VOICE HANDLERS
// ---------------------------------------------------------

micBtn.addEventListener('click', toggleRecording);

async function toggleRecording() {
    if (!isRecording) {
        startRecording();
    } else {
        stopRecording();
    }
}

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = (event) => audioChunks.push(event.data);
        mediaRecorder.onstop = processAudio;

        mediaRecorder.start();
        isRecording = true;
        micBtn.classList.add('listening');
        statusText.innerText = 'Listening...';
        userInput.placeholder = 'Listening...';
    } catch (err) {
        console.error("Mic Error:", err);
        addMessage("⚠️ Microphone access denied. Check permissions.", false);
    }
}

function stopRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        isRecording = false;
        micBtn.classList.remove('listening');
        micBtn.classList.add('processing');
        statusText.innerText = 'Processing...';
    }
}

async function processAudio() {
    const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
    const formData = new FormData();
    formData.append('audio', audioBlob, 'input.wav');

    try {
        // 1. Transcribe via Groq
        const res = await fetch('/api/transcribe', { method: 'POST', body: formData });
        const data = await res.json();

        micBtn.classList.remove('processing');

        if (data.text) {
            userInput.value = data.text;
            userInput.placeholder = 'Type your message...';
            // Auto-send
            sendMessage();
        } else {
            addMessage("⚠️ Couldn't hear that. Try again.", false);
            statusText.innerText = 'Ready';
        }
    } catch (err) {
        console.error(err);
        micBtn.classList.remove('processing');
        statusText.innerText = 'Error';
    }
}

function speak(text) {
    if (!text) return;
    // Basic cleanup for speech
    const clean = text.replace(/[*#]/g, '').replace(/https?:\/\/\S+/g, 'link');
    const u = new SpeechSynthesisUtterance(clean);
    synthesis.speak(u);
}

// ---------------------------------------------------------
//  CHAT & UI HANDLERS (Replicated from Chat UI)
// ---------------------------------------------------------

function addMessage(text, isBot = true) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `msg ${isBot ? 'bot-msg' : 'user-msg'} animate-up`;
    msgDiv.innerHTML = `<p>${text}</p>`;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function updatePreferenceTags(data) {
    const preferencesBar = document.getElementById('preferences-bar');
    const preferenceTags = document.getElementById('preference-tags');

    if (!data || !data.user_preferences) return;

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
    synthesis.cancel();

    statusText.innerText = 'Thinking...';

    try {
        // USE PROXY ENDPOINT
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, message: text }) // Proxies to 3000
        });

        const data = await response.json();
        const apiResponse = data.response; // { message, itinerary, etc }

        // 1. Update Tags
        if (apiResponse && (apiResponse.user_preferences || apiResponse.state === 'READY_FOR_UI')) {
            updatePreferenceTags(apiResponse);
        }

        // 2. Handle Text
        if (apiResponse.message) {
            let formattedMsg = apiResponse.message.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            formattedMsg = formattedMsg.replace(/\*Sources: (.*?)\*/g, '<br><em class="source-cite">Sources: $1</em>');
            addMessage(formattedMsg);

            // TTS TRIGGER
            speak(apiResponse.message);
        }

        // 3. Handle Itinerary
        else if (apiResponse.state === 'READY_FOR_UI') {
            addMessage("I've generated your itinerary! You can see it below.");
            speak("I have generated your itinerary. You can verify the details below.");
            renderItinerary(apiResponse);
        }

        else if (typeof apiResponse === 'string') {
            addMessage(apiResponse);
            speak(apiResponse);
        }

        statusText.innerText = 'Ready';

    } catch (error) {
        console.error(error);
        addMessage("Sorry, connection failed.");
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
                                        </div>
                                    </div>
                                </div>`;
    }).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
        <div class="action-buttons">
            <button class="action-btn glass" onclick="exportPDF()"><span>📄</span> Export PDF</button>
            <button class="action-btn glass" onclick="showEmailDialog()"><span>📧</span> Email</button>
        </div>
    `;

    // Smooth scroll to itinerary
    itineraryDisplay.scrollIntoView({ behavior: 'smooth' });
}

// Event Listeners
sendBtn.addEventListener('click', sendMessage);
userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

// Reuse dialog functions from Chat UI (Export, Email) logic omitted for brevity unless requested 
// (assuming global functions are okay, adding placeholders to prevent errors)
window.exportPDF = () => alert("Use 'export pdf' command via voice or text.");
window.showEmailDialog = () => alert("Use 'email to...' command via voice or text.");
