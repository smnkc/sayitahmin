const app = (() => {
    // State
    let mode = null; // 'single' | 'multi'
    let roomId = null;
    let playerId = null; // 'p1' or 'p2'
    let pollInterval = null;
    let stateCache = null;

    // Game variables
    let mySecret = null;
    let turn = 'p1';
    let isGameFinished = false;

    // Single Player variables
    let botSecret = null;
    let botMin = 1;
    let botMax = 1000;

    // UI Elements
    const screens = {
        home: document.getElementById('screen-home'),
        join: document.getElementById('screen-join'),
        waiting: document.getElementById('screen-waiting'),
        game: document.getElementById('screen-game')
    };

    const ui = {
        roomCodeDisplay: document.getElementById('waiting-room-code'),
        setupPhase: document.getElementById('setup-phase'),
        playPhase: document.getElementById('play-phase'),
        finishedPhase: document.getElementById('finished-phase'),
        guessButton: document.getElementById('guess-button'),
        turnIndicator: document.getElementById('turn-indicator'),
        gameFeedback: document.getElementById('game-feedback'),
        prominentFeedback: document.getElementById('prominent-feedback'),
        guessHistory: document.getElementById('guess-history'),
        secretInput: document.getElementById('secret-number'),
        guessInput: document.getElementById('guess-number'),
        winnerDetails: document.getElementById('winner-details'),
        winnerText: document.getElementById('winner-text')
    };

    // Restore Session
    const initSession = () => {
        const smode = sessionStorage.getItem('mode');
        const sroom = sessionStorage.getItem('roomId');
        const splayer = sessionStorage.getItem('playerId');
        
        if (smode === 'multi' && sroom && splayer) {
            mode = smode;
            roomId = sroom;
            playerId = splayer;
            startPolling(); // Will catch up via fetchRoomState
        }
    };

    // Helper: Show Screen
    const switchScreen = (screenId) => {
        Object.values(screens).forEach(s => s.classList.remove('active'));
        if (screens[screenId]) screens[screenId].classList.add('active');
    };

    // Helper: Show notification
    const notify = (msg) => {
        const notif = document.getElementById('notification');
        notif.textContent = msg;
        notif.classList.add('show');
        setTimeout(() => notif.classList.remove('show'), 3000);
    };

    // API Helpers
    const apiCall = async (endpoint, data = null) => {
        const options = {
            method: data ? 'POST' : 'GET',
            headers: { 'Content-Type': 'application/json' }
        };
        if (data) options.body = JSON.stringify(data);
        
        let url = `api.php?route=${endpoint}`;
        // If it's a GET request with query params, append them differently
        if (endpoint.includes('?')) {
            const [route, params] = endpoint.split('?');
            url = `api.php?route=${route}&${params}`;
        }

        const res = await fetch(url, options);
        if (!res.ok) {
            const err = await res.json().catch(()=>({}));
            throw new Error(err.error || 'API Error');
        }
        return res.json();
    };

    // ---- NAVIGATION ACTION ----
    const showHome = () => {
        stopPolling();
        if (mode === 'multi' && roomId && !isGameFinished) {
            apiCall('room/leave', { id: roomId }).catch(()=>({}));
        }
        mode = null;
        roomId = null;
        playerId = null;
        sessionStorage.clear();
        switchScreen('home');
        document.getElementById('join-code').value = '';
    };

    const showCreateRoom = async () => {
        try {
            const data = await apiCall('room', {});
            mode = 'multi';
            roomId = data.id;
            playerId = data.playerId; // p1
            sessionStorage.setItem('mode', mode);
            sessionStorage.setItem('roomId', roomId);
            sessionStorage.setItem('playerId', playerId);
            ui.roomCodeDisplay.textContent = roomId;
            switchScreen('waiting');
            startPolling();
        } catch (err) {
            notify("Oda kurulamadı!");
        }
    };

    const showJoinRoom = () => {
        switchScreen('join');
    };

    const joinRoom = async () => {
        const codeInput = document.getElementById('join-code').value.trim();
        if (codeInput.length !== 6) return notify("6 Haneli kod girin");
        
        try {
            const data = await apiCall('room/join', { id: codeInput });
            mode = 'multi';
            roomId = data.id;
            playerId = data.playerId; // p2
            sessionStorage.setItem('mode', mode);
            sessionStorage.setItem('roomId', roomId);
            sessionStorage.setItem('playerId', playerId);
            switchScreen('game');
            setupGameUI();
            startPolling();
        } catch (err) {
            notify(err.message || "Katılım başarısız");
        }
    };

    // ---- GAME LOGIC ----
    const startSinglePlayer = () => {
        mode = 'single';
        botSecret = Math.floor(Math.random() * 1000) + 1;
        botMin = 1;
        botMax = 1000;
        turn = 'p1'; // user is p1
        isGameFinished = false;
        
        switchScreen('game');
        setupGameUI();
    };

    const setupGameUI = () => {
        ui.setupPhase.style.display = 'block';
        ui.playPhase.style.display = 'none';
        ui.finishedPhase.style.display = 'none';
        ui.guessHistory.innerHTML = '';
        ui.prominentFeedback.style.display = 'none';
        ui.prominentFeedback.innerHTML = '';
        ui.secretInput.value = '';
        ui.guessInput.value = '';
        mySecret = null;
        isGameFinished = false;
        document.getElementById('game-title').textContent = "Sayıyı Belirle";
    };

    const setRandomSecret = () => {
        ui.secretInput.value = Math.floor(Math.random() * 1000) + 1;
    };

    const confirmSecret = async () => {
        const val = parseInt(ui.secretInput.value);
        if (isNaN(val) || val < 1 || val > 1000) {
            return notify("Lütfen 1-1000 arası sayı girin");
        }
        
        mySecret = val;
        
        if (mode === 'single') {
            ui.setupPhase.style.display = 'none';
            ui.playPhase.style.display = 'block';
            document.getElementById('game-title').textContent = "Oyun Başladı!";
            updateTurnUI();
        } else {
            try {
                await apiCall('room/action', { id: roomId, playerId, action: 'set_secret', value: val });
                ui.setupPhase.style.display = 'none';
                ui.playPhase.style.display = 'block';
                document.getElementById('game-title').textContent = "Rakip Bekleniyor...";
                ui.playPhase.style.opacity = '0.5';
                ui.guessButton.disabled = true;
            } catch (err) {
                notify("Hata: " + err.message);
                mySecret = null; // revert
            }
        }
    };

    const makeGuess = async () => {
        if (turn !== playerId && mode === 'multi') return notify("Sıra sizde değil!");
        if (turn !== 'p1' && mode === 'single') return; // Should not happen
        
        const val = parseInt(ui.guessInput.value);
        if (isNaN(val) || val < 1 || val > 1000) {
            return notify("Lütfen 1-1000 arası sayı girin");
        }

        ui.guessInput.value = '';
        ui.guessButton.disabled = true;

        if (mode === 'single') {
            processSinglePlayerGuess(val);
        } else {
            try {
                await apiCall('room/action', { id: roomId, playerId, action: 'guess', value: val });
                // polling will update the UI
            } catch (err) {
                notify(err.message);
                ui.guessButton.disabled = false;
            }
        }
    };

    const processSinglePlayerGuess = (val) => {
        let feedback = '';
        if (val === botSecret) {
            handleWin('p1', botSecret);
            return;
        } else if (val < botSecret) {
            feedback = 'up';
            addHistoryItem('Sen', val, 'Yukarı!', feedback);
            showProminentFeedback('Sen', val, 'Yukarı!', feedback);
        } else {
            feedback = 'down';
            addHistoryItem('Sen', val, 'Aşağı!', feedback);
            showProminentFeedback('Sen', val, 'Aşağı!', feedback);
        }

        turn = 'p2'; // Bot's turn
        updateTurnUI();

        // Bot plays after 1.5s
        setTimeout(botMakeGuess, 1500);
    };

    const botMakeGuess = () => {
        if (isGameFinished) return;
        
        const range = botMax - botMin;
        let guess;
        
        if (range <= 3) {
            // Pick exactly if range is tiny
            guess = Math.floor(Math.random() * (range + 1)) + botMin;
        } else {
            // Aim for the middle, with a "human error" offset of ±15%
            const middle = Math.floor((botMin + botMax) / 2);
            const offset = Math.floor((Math.random() - 0.5) * (range * 0.3));
            guess = middle + offset;
            
            // Safety clamp
            guess = Math.max(botMin, Math.min(botMax, guess));
        }
        
        if (guess === mySecret) {
            handleWin('p2', guess);
            return;
        } else if (guess < mySecret) {
            addHistoryItem('Robot', guess, 'Yukarı!', 'up');
            showProminentFeedback('Robot', guess, 'Yukarı!', 'up');
            botMin = guess + 1; // refine search space
        } else {
            addHistoryItem('Robot', guess, 'Aşağı!', 'down');
            showProminentFeedback('Robot', guess, 'Aşağı!', 'down');
            botMax = guess - 1;
        }

        turn = 'p1';
        updateTurnUI();
    };

    const addHistoryItem = (who, val, text, type) => {
        const li = document.createElement('li');
        li.innerHTML = `<span><b>${who}:</b> <span class="val">${val}</span></span> <span class="res ${type}">${text}</span>`;
        ui.guessHistory.prepend(li);
    };

    const showProminentFeedback = (who, val, text, type) => {
        ui.prominentFeedback.style.display = 'block';
        ui.prominentFeedback.innerHTML = `<div>${who} - ${val} Tahmini</div><div style="font-size: 2rem; margin-top: 5px;">${text}</div>`;
        if (type === 'up') {
            ui.prominentFeedback.style.background = 'rgba(16, 185, 129, 0.2)';
            ui.prominentFeedback.style.color = 'var(--success)';
            ui.prominentFeedback.style.border = '2px solid var(--success)';
        } else if (type === 'down') {
            ui.prominentFeedback.style.background = 'rgba(239, 68, 68, 0.2)';
            ui.prominentFeedback.style.color = 'var(--danger)';
            ui.prominentFeedback.style.border = '2px solid var(--danger)';
        }
    };

    const updateTurnUI = () => {
        if (isGameFinished) return;

        const isMyTurn = (mode === 'single' && turn === 'p1') || (mode === 'multi' && turn === playerId);
        
        if (isMyTurn) {
            ui.turnIndicator.textContent = "Sıra Sende!";
            ui.turnIndicator.className = "turn-indicator";
            ui.gameFeedback.textContent = "Tahminini yap";
            ui.guessButton.disabled = false;
        } else {
            ui.turnIndicator.textContent = mode === 'single' ? "Robot Düşünüyor..." : "Rakip Düşünüyor...";
            ui.turnIndicator.className = "turn-indicator enemy";
            ui.gameFeedback.textContent = "Lütfen bekle";
            ui.guessButton.disabled = true;
        }
    };

    const handleWin = (winnerId, correctValue) => {
        isGameFinished = true;
        ui.playPhase.style.display = 'none';
        ui.finishedPhase.style.display = 'block';
        document.getElementById('game-title').textContent = "Oyun Bitti!";
        stopPolling();

        const amIWinner = (mode === 'single' && winnerId === 'p1') || (mode === 'multi' && winnerId === playerId);
        
        if (amIWinner) {
            ui.winnerText.textContent = "Kazandın! 🎉";
            ui.winnerText.style.color = "var(--success)";
            ui.winnerText.style.textShadow = "0 0 20px rgba(16, 185, 129, 0.4)";
            ui.winnerDetails.textContent = `Doğru bildin: ${correctValue}`;
        } else {
            ui.winnerText.textContent = "Kaybettin! 😢";
            ui.winnerText.style.color = "var(--danger)";
            ui.winnerText.style.textShadow = "0 0 20px rgba(239, 68, 68, 0.4)";
            const rivalName = mode === 'single' ? "Robot" : "Rakip";
            ui.winnerDetails.textContent = `${rivalName} senin sayını (${correctValue}) buldu!`;
        }
    };

    // ---- MULTIPLAYER POLLING ----
    const startPolling = () => {
        if (pollInterval) clearInterval(pollInterval);
        pollInterval = setInterval(fetchRoomState, 2000);
        fetchRoomState();
    };

    const stopPolling = () => {
        if (pollInterval) clearInterval(pollInterval);
        pollInterval = null;
    };

    const fetchRoomState = async () => {
        if (!roomId || !playerId) return;
        try {
            const state = await apiCall(`room/status?id=${roomId}&playerId=${playerId}`);
            
            // Check state changes
            if (state.state === 'waiting') {
               switchScreen('waiting');
               ui.roomCodeDisplay.textContent = roomId;
            } 
            else if (state.state === 'abandoned') {
                notify("Rakip oyundan ayrıldı!");
                showHome();
                return;
            }
            else if (state.state === 'setup' || state.state === 'playing' || state.state === 'finished') {
                if (!screens.game.classList.contains('active')) {
                    switchScreen('game');
                    setupGameUI();
                    if (state.state === 'setup') notify("Rakip katıldı, Seçimini yap!");
                }
                
                // Restore own secret if refreshed
                if (state[playerId].secret !== null && mySecret === null) {
                    mySecret = state[playerId].secret;
                    ui.setupPhase.style.display = 'none';
                    ui.playPhase.style.display = 'block';
                }

                // If I am in play state, update UI based on turn
                if (state.p1.secret !== null && state.p2.secret !== null && ui.setupPhase.style.display === 'none') {
                    ui.playPhase.style.opacity = '1';
                    document.getElementById('game-title').textContent = "Oyun Başladı!";
                    
                    // Did turn change? Did someone guess?
                    // We need to figure out history. Since we don't have an append-only log array in JSON,
                    // we just show the LAST move if it changed.
                    
                    const p1diff = state.p1.last_guess !== (stateCache?.p1?.last_guess);
                    const p2diff = state.p2.last_guess !== (stateCache?.p2?.last_guess);

                    if (p1diff && state.p1.last_guess) {
                        const fb = getFeedbackTR(state.p1.last_feedback);
                        addHistoryItem('Kurucu', state.p1.last_guess, fb.t, fb.c);
                        showProminentFeedback('Kurucu', state.p1.last_guess, fb.t, fb.c);
                    }
                    if (p2diff && state.p2.last_guess) {
                        const fb = getFeedbackTR(state.p2.last_feedback);
                        addHistoryItem('Katılan', state.p2.last_guess, fb.t, fb.c);
                        showProminentFeedback('Katılan', state.p2.last_guess, fb.t, fb.c);
                    }

                    turn = state.turn;

                    if (state.state === 'finished') {
                        const winner = state.winner;
                        // Find what was the correct guess
                        const winnerLastGuess = state[winner].last_guess;
                        handleWin(winner, winnerLastGuess);
                    } else {
                        updateTurnUI();
                    }
                }
            }
            stateCache = state;
        } catch (err) {
            console.error("Poll error", err);
            // Optionally redirect to home if room deleted
            if (err.message.includes("404")) {
                notify("Oda kapandı veya bulunamadı.");
                showHome();
            }
        }
    };

    const getFeedbackTR = (fb) => {
        if (fb === 'up') return { t: 'Yukarı!', c: 'up' };
        if (fb === 'down') return { t: 'Aşağı!', c: 'down' };
        if (fb === 'correct') return { t: 'Doğru!', c: 'correct' };
        return { t: '', c: '' };
    };

    // Boot up
    initSession();

    // Public API
    return {
        showHome,
        showCreateRoom,
        showJoinRoom,
        joinRoom,
        startSinglePlayer,
        setRandomSecret,
        confirmSecret,
        makeGuess
    };
})();
