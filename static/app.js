// Global animal configuration
let animalConfig = {};
const webcamElement = document.getElementById('webcam');
const startScreen = document.getElementById('start-screen');
const magicOverlay = document.getElementById('magic-overlay');
const animalNameContainer = document.getElementById('animal-name-container');
const plushMountain = document.getElementById('plush-mountain');
const backButton = document.getElementById('backButton');
const cameraSwitchButton = document.getElementById('cameraSwitchButton');
const brainBadge = document.getElementById('brain-badge');
const audioPlayer = document.getElementById('audio-player');

let availableAnimals = [];
let quizMode = false;
let currentFacingMode = 'user';
let audioContext = null;
const soundBufferCache = new Map();
let audioPrimed = false;
let soundsPreloaded = false;

// 1. Initialization: Fetch animal configuration and create plush pile
async function init() {
    try {
        const configResponse = await fetch('/api/config');
        const configJson = await configResponse.json();
        if (configJson.success) {
            animalConfig = configJson.data;
        } else {
            console.error('Failed to load sound config:', configJson.error);
        }

        const imagesResponse = await fetch('/api/images');
        const imagesJson = await imagesResponse.json();
        if (imagesJson.success) {
            availableAnimals = imagesJson.data;
        } else {
            console.error('Failed to load animal images:', imagesJson.error);
        }

        if (availableAnimals.length > 0) {
            createStartScreenPile();
        } else {
            console.warn('No animals found in animal_images/ folder.');
        }
    } catch (error) {
        console.error('Failed to initialize app:', error);
    }
}

// 1b. Start Screen Layout: Distribute animals into CSS flex strips
function createStartScreenPile() {
    if (!availableAnimals || availableAnimals.length === 0) return;

    const topEl = document.getElementById('animals-top');
    const bottomEl = document.getElementById('animals-bottom');
    const leftEl = document.getElementById('animals-left');
    const rightEl = document.getElementById('animals-right');
    [topEl, bottomEl, leftEl, rightEl].forEach(el => el.innerHTML = '');

    let roster = [...availableAnimals].sort(() => Math.random() - 0.5);
    const total = roster.length;
    const perSide = Math.floor(total / 4);
    const extras = total % 4;

    const counts = [perSide, perSide, perSide, perSide];
    for (let i = 0; i < extras; i++) counts[i]++;

    const strips = [topEl, bottomEl, leftEl, rightEl];
    let idx = 0;
    strips.forEach((strip, s) => {
        for (let i = 0; i < counts[s]; i++) {
            if (idx >= total) return;
            const animal = roster[idx++];
            const img = document.createElement('img');
            img.src = `/animal_images/${animal}.png`;
            img.dataset.animal = animal;
            img.title = animal;
            const rotation = Math.floor(Math.random() * 30) - 15;
            const scale = 0.9 + Math.random() * 0.2;
            img.style.transform = `rotate(${rotation}deg) scale(${scale})`;
            img.style.cursor = 'pointer';
            img.addEventListener('click', () => {
                playAnimalSound(animal);
            });
            strip.appendChild(img);
        }
    });
}

// 1c. Camera Frame Layout: Animals form a border around the live feed
function createCameraFramePile() {
    if (!availableAnimals || availableAnimals.length === 0) return;

    const topEl = document.getElementById('cam-animals-top');
    const bottomEl = document.getElementById('cam-animals-bottom');
    const leftEl = document.getElementById('cam-animals-left');
    const rightEl = document.getElementById('cam-animals-right');
    [topEl, bottomEl, leftEl, rightEl].forEach(el => el.innerHTML = '');

    let roster = [...availableAnimals].sort(() => Math.random() - 0.5);
    const total = roster.length;
    const perSide = Math.floor(total / 4);
    const extras = total % 4;

    const counts = [perSide, perSide, perSide, perSide];
    for (let i = 0; i < extras; i++) counts[i]++;

    const strips = [topEl, bottomEl, leftEl, rightEl];
    let idx = 0;
    strips.forEach((strip, s) => {
        for (let i = 0; i < counts[s]; i++) {
            if (idx >= total) return;
            const animal = roster[idx++];
            const img = document.createElement('img');
            img.src = `/animal_images/${animal}.png`;
            img.dataset.animal = animal;
            const rotation = Math.floor(Math.random() * 20) - 10;
            const scale = 0.9 + Math.random() * 0.2;
            img.style.transform = `rotate(${rotation}deg) scale(${scale})`;
            strip.appendChild(img);
        }
    });
}

// 2. Disable right-click for toddler-proofing
document.addEventListener('contextmenu', (e) => e.preventDefault());

function stopWebcam() {
    if (webcamElement.srcObject) {
        webcamElement.srcObject.getTracks().forEach(track => track.stop());
        webcamElement.srcObject = null;
    }
}

async function unlockAudio() {
    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return false;

        if (!audioContext) {
            audioContext = new AudioContextClass();
        }

        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }

        return audioContext.state === 'running';
    } catch (error) {
        console.warn('Audio unlock failed:', error);
        return false;
    }
}

async function primeAudioPlayback() {
    if (!audioPlayer || audioPrimed) {
        return;
    }

    try {
        audioPlayer.src = 'data:audio/wav;base64,UklGRlQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YTAAAAA=';
        audioPlayer.muted = true;
        await audioPlayer.play();
        audioPlayer.pause();
        audioPlayer.currentTime = 0;
        audioPlayer.muted = false;
        audioPlayer.removeAttribute('src');
        audioPlayer.load();
        audioPrimed = true;
    } catch (error) {
        console.warn('Audio element prime failed:', error);
    }
}

async function preloadAllSounds() {
    if (soundsPreloaded || !animalConfig) {
        return;
    }

    soundsPreloaded = true;
    const uniquePaths = [...new Set(Object.values(animalConfig).flat())];

    await Promise.allSettled(uniquePaths.map(async (path) => {
        try {
            const response = await fetch(path, { cache: 'force-cache' });
            await response.arrayBuffer();
        } catch (error) {
            console.warn('Sound preload failed:', path, error);
        }
    }));
}

async function getCameraStream(facingMode) {
    const videoVariants = [
        {
            facingMode: { exact: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 }
        },
        {
            facingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 }
        },
        {
            width: { ideal: 1280 },
            height: { ideal: 720 }
        }
    ];

    let lastError = null;
    for (const video of videoVariants) {
        try {
            return await navigator.mediaDevices.getUserMedia({ video, audio: false });
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError;
}

async function startCamera(facingMode = currentFacingMode) {
    currentFacingMode = facingMode;
    stopCapture();

    try {
        await primeAudioPlayback();
        await unlockAudio();
        void preloadAllSounds();
        stopWebcam();

        const stream = await getCameraStream(currentFacingMode);
        webcamElement.srcObject = stream;
        webcamElement.onloadedmetadata = async () => {
            try {
                await webcamElement.play();
            } catch (playError) {
                console.warn('Video playback needs another gesture:', playError);
            }

            webcamElement.classList.add('active');
            startScreen.classList.add('hidden');
            backButton.classList.remove('hidden');
            cameraSwitchButton.classList.remove('hidden');
            createCameraFramePile();

            if (quizMode) {
                if (quizActive) {
                    startAutoCapture();
                } else {
                    startQuizMode();
                }
            } else {
                startAutoCapture();
            }
        };
    } catch (error) {
        console.error('Permission denied or error starting:', error);
        alert('Please allow camera access to play!');
    }
}

document.getElementById('startButton').addEventListener('click', () => {
    quizMode = false;
    startCamera('user');
});

document.getElementById('quizButton').addEventListener('click', () => {
    quizMode = true;
    startCamera('user');
});

cameraSwitchButton.addEventListener('click', async () => {
    const nextMode = currentFacingMode === 'user' ? 'environment' : 'user';
    await startCamera(nextMode);
});

backButton.addEventListener('click', () => {
    // Hide back button
    backButton.classList.add('hidden');
    cameraSwitchButton.classList.add('hidden');

    // Stop everything
    stopCapture();
    clearTimeout(quizHintTimeout);
    clearTimeout(quizTimerTimeout);
    clearTimeout(quizNextRoundTimeout);
    clearTimeout(quizHintTimeout); // extra safety
    quizActive = false;
    quizTransitioning = false;
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();

    // Stop webcam
    stopWebcam();
    webcamElement.classList.remove('active');

    // Clear camera frame strips (prevent leftovers)
    ['cam-animals-top', 'cam-animals-bottom', 'cam-animals-left', 'cam-animals-right'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '';
    });

    // Clear animal name container
    animalNameContainer.classList.remove('visible');
    animalNameContainer.textContent = '';

    // Clear celebration overlay
    const overlay = document.getElementById('celebration-overlay');
    if (overlay) overlay.classList.remove('active', 'fade-image');

    // Hide quiz UI
    document.getElementById('quiz-overlay').classList.add('hidden');
    document.getElementById('quiz-success-overlay').classList.add('hidden');
    document.getElementById('quiz-hint-image-container').classList.add('hidden');
    document.getElementById('quiz-timer-bar-container').classList.add('hidden');
    document.getElementById('quiz-timeout-options').classList.add('hidden');

    if (brainBadge) brainBadge.classList.remove('active');

    // Show start screen
    startScreen.classList.remove('hidden');
});

// 4. Silent background polling
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

let currentDelay = 3000;
let captureRunning = false;

async function startAutoCapture() {
    if (captureRunning) return;
    captureRunning = true;
    await sleep(2000);
    captureLoop();
}

async function captureLoop() {
    while (captureRunning) {
        if (!webcamElement.srcObject) { captureRunning = false; return; }
        await doCapture();
        await sleep(currentDelay);
    }
}

function stopCapture() {
    captureRunning = false;
}

async function doCapture() {
    if (quizMode && quizTransitioning) {
        return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = webcamElement.videoWidth;
    canvas.height = webcamElement.videoHeight;
    canvas.getContext('2d').drawImage(webcamElement, 0, 0);
    const imageData = canvas.toDataURL('image/jpeg', 0.8);

    try {
        const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ base64_image: imageData })
        });
        const result = await response.json();
        if (!result.success) {
            console.error('Analyze failed:', result.error);
            if (brainBadge) {
                brainBadge.textContent = 'Still waking up...';
                brainBadge.classList.add('active');
            }
            currentDelay = 5000;
            return;
        }

        const data = result.data;

        if (data.animal && data.animal !== 'unknown') {
            if (quizMode) {
                quizSuccess(data.animal);
            } else {
                if (brainBadge) { brainBadge.textContent = 'Found it!'; brainBadge.classList.add('active'); }
                handleSuccess(data.animal);
                highlightAnimal(data.animal, 12000);
                currentDelay = 12000;
            }
        } else {
            if (brainBadge) { brainBadge.textContent = 'Looking...'; brainBadge.classList.add('active'); }
            currentDelay = 3000;
        }
    } catch (e) {
        console.error('Capture error:', e);
        if (brainBadge) {
            brainBadge.textContent = 'Trying again...';
            brainBadge.classList.add('active');
        }
        currentDelay = 4000;
    }
}

// 5. Feedback Logic (Explore mode)
function handleSuccess(animal) {
    playAnimalSound(animal);
    magicOverlay.classList.remove('flash-active');
    void magicOverlay.offsetWidth;
    magicOverlay.classList.add('flash-active');
    showNameAnimation(animal);
}

async function loadSoundBuffer(path) {
    if (soundBufferCache.has(path)) {
        return soundBufferCache.get(path);
    }

    if (!audioContext) {
        return null;
    }

    const response = await fetch(path);
    const arrayBuffer = await response.arrayBuffer();
    const decodedBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    soundBufferCache.set(path, decodedBuffer);
    return decodedBuffer;
}

async function playAnimalSound(animal) {
    const paths = animalConfig[animal];
    if (!paths || paths.length === 0) {
        console.log(`No sound for "${animal}" — showing name only`);
        return;
    }

    const randomPath = paths[Math.floor(Math.random() * paths.length)];
    const unlocked = await unlockAudio();

    if (audioPlayer) {
        try {
            audioPlayer.pause();
            audioPlayer.src = randomPath;
            audioPlayer.load();
            audioPlayer.currentTime = 0;
            await audioPlayer.play();
            return;
        } catch (error) {
            console.warn('Persistent audio element playback failed:', error);
        }
    }

    if (unlocked && audioContext) {
        try {
            const buffer = await loadSoundBuffer(randomPath);
            if (buffer) {
                const source = audioContext.createBufferSource();
                source.buffer = buffer;
                source.connect(audioContext.destination);
                source.start(0);
                return;
            }
        } catch (error) {
            console.warn('Web Audio playback fallback failed:', error);
        }
    }
}

function showNameAnimation(animal) {
    const overlay = document.getElementById('celebration-overlay');
    const celebImage = document.getElementById('celebration-image');
    const celebName = document.getElementById('celebration-name');

    overlay.classList.remove('active', 'fade-image');
    animalNameContainer.classList.remove('visible');
    animalNameContainer.textContent = '';

    celebImage.src = `/animal_images/${animal}.png`;
    celebName.textContent = animal;

    requestAnimationFrame(() => {
        overlay.classList.add('active');
    });

    setTimeout(() => {
        overlay.classList.add('fade-image');
    }, 2000);

    setTimeout(() => {
        overlay.classList.remove('active', 'fade-image');
        animalNameContainer.textContent = animal;
        animalNameContainer.classList.add('visible');
    }, 2500);

    setTimeout(() => {
        animalNameContainer.classList.remove('visible');
    }, 10000);
}

// 6. Highlight camera frame animals
function highlightAnimal(animal, duration) {
    const items = document.querySelectorAll(
        `#cam-animals-top img[data-animal='${animal}'],
         #cam-animals-bottom img[data-animal='${animal}'],
         #cam-animals-left img[data-animal='${animal}'],
         #cam-animals-right img[data-animal='${animal}']`
    );
    items.forEach(item => item.classList.add('celebrate'));
    setTimeout(() => {
        items.forEach(item => item.classList.remove('celebrate'));
    }, duration);
}

// ============================================
// 7. QUIZ MODE
// ============================================

const HINT_DELAY_MS = 20000;
const HINT_DURATION_MS = 8000;

let quizTargetAnimal = null;
let quizHintTimeout = null;
let quizTimerTimeout = null;
let quizNextRoundTimeout = null;
let quizActive = false;
let quizTransitioning = false;

function startQuizMode() {
    document.getElementById('quiz-overlay').classList.remove('hidden');
    pickNextQuizAnimal();
}

function pickNextQuizAnimal() {
    quizActive = true;
    quizTransitioning = false;

    // Clear previous state
    clearTimeout(quizHintTimeout);
    clearTimeout(quizTimerTimeout);
    clearTimeout(quizNextRoundTimeout);
    document.getElementById('quiz-hint-image-container').classList.add('hidden');
    document.getElementById('quiz-timer-bar-container').classList.add('hidden');
    document.getElementById('quiz-success-overlay').classList.add('hidden');
    document.getElementById('quiz-timeout-options').classList.add('hidden');

    // Pick a random animal that has a sound (for the best experience)
    const animals = Object.keys(animalConfig).filter(a => availableAnimals.includes(a));
    if (animals.length === 0) return;
    quizTargetAnimal = animals[Math.floor(Math.random() * animals.length)];

    // Show the target name with pop animation
    const targetEl = document.getElementById('quiz-target-animal');
    targetEl.textContent = quizTargetAnimal;
    targetEl.classList.remove('pop-anim');
    void targetEl.offsetWidth;
    targetEl.classList.add('pop-anim');

    // Text-to-speech
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance('Find me the ' + quizTargetAnimal);
        utterance.rate = 0.85;
        utterance.pitch = 1.2;
        window.speechSynthesis.speak(utterance);
    }

    // Start capture polling
    captureRunning = false; // reset
    startAutoCapture();

    // After delay, show hint image
    quizHintTimeout = setTimeout(() => {
        showQuizHint();
    }, HINT_DELAY_MS);
}

function showQuizHint() {
    const hintImg = document.getElementById('quiz-hint-image');
    hintImg.src = '/animal_images/' + quizTargetAnimal + '.png';
    document.getElementById('quiz-hint-image-container').classList.remove('hidden');

    // Speak hint
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance("Here is a hint!");
        utterance.rate = 0.85;
        utterance.pitch = 1.2;
        window.speechSynthesis.speak(utterance);
    }

    // Start the countdown timer bar
    const timerBar = document.getElementById('quiz-timer-bar');
    const timerContainer = document.getElementById('quiz-timer-bar-container');
    timerContainer.classList.remove('hidden');
    timerBar.style.transition = 'none';
    timerBar.style.width = '100%';
    void timerBar.offsetWidth;
    timerBar.style.transition = `width ${HINT_DURATION_MS}ms linear`;
    timerBar.style.width = '0%';

    // After timer runs out, show the Skip button but STAY active
    quizTimerTimeout = setTimeout(() => {
        if (quizActive) {
            document.getElementById('quiz-timeout-options').classList.remove('hidden');
            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
                const skipUtterance = new SpeechSynthesisUtterance("Still looking? You can skip if you want, or just keep trying!");
                skipUtterance.rate = 0.85;
                window.speechSynthesis.speak(skipUtterance);
            }
        }
    }, HINT_DURATION_MS);
}

async function quizSuccess(animal) {
    if (!quizActive || quizTransitioning || animal !== quizTargetAnimal) return;
    quizActive = false;
    quizTransitioning = true;

    clearTimeout(quizHintTimeout);
    clearTimeout(quizTimerTimeout);
    clearTimeout(quizNextRoundTimeout);
    stopCapture();

    // Show success overlay
    document.getElementById('quiz-success-overlay').classList.remove('hidden');

    // Speak success
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance('Amazing! You found the ' + animal + '!');
        utterance.rate = 0.85;
        utterance.pitch = 1.3;
        window.speechSynthesis.speak(utterance);
    }

    // Play animal sound and highlight
    await playAnimalSound(animal);
    highlightAnimal(animal, 3500);

    // After 3.5s, pick next animal
    quizNextRoundTimeout = setTimeout(() => {
        pickNextQuizAnimal();
    }, 3500);
}

// Initialize on load
window.addEventListener('load', () => {
    init();
    // Quiz skip listener
    document.getElementById('quiz-skip-btn').addEventListener('click', () => {
        if (quizActive) pickNextQuizAnimal();
    });
});
