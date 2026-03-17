// Global animal configuration
let animalConfig = {};
const webcamElement = document.getElementById('webcam');
const startButton = document.getElementById('startButton');
const startScreen = document.getElementById('start-screen');
const magicOverlay = document.getElementById('magic-overlay');
const animalNameContainer = document.getElementById('animal-name-container');
const plushMountain = document.getElementById('plush-mountain');

let availableAnimals = [];

// 1. Initialization: Fetch animal configuration and create plush pile
async function init() {
    try {
        // Fetch sound config
        const configResponse = await fetch('/api/config');
        animalConfig = await configResponse.json();

        // Fetch animal images list
        const imagesResponse = await fetch('/api/images');
        availableAnimals = await imagesResponse.json();

        if (availableAnimals.length > 0) {
            createPlushPile();
        } else {
            console.warn('No animals found in animal_images/ folder.');
        }
    } catch (error) {
        console.error('Failed to initialize app:', error);
    }
}

// 1b. Create the background "Plush Mountain" (Less is More Refinement)
function createPlushPile() {
    if (!availableAnimals || availableAnimals.length === 0) return;
    
    // Clear existing pile to prevent duplicates on re-init
    plushMountain.innerHTML = '';
    console.log(`Creating plush pile with ${availableAnimals.length} unique animals:`, availableAnimals);

    // 1. Each animal exactly once
    let roster = [...availableAnimals];
    const targetTotal = roster.length;

    // 2. Shuffle roster
    roster = roster.sort(() => Math.random() - 0.5);

    // 3. Distribute slots proportionally across the 4 edges
    const slots = [];
    const countPerEdge = Math.ceil(targetTotal / 4);
    
    // Top Edge
    for (let i = 0; i < countPerEdge && slots.length < targetTotal; i++) {
        const x = -10 + (i * (100 / countPerEdge)); 
        const y = -12 + Math.random() * 8;
        slots.push({ x, y, edge: 'top' });
    }

    // Bottom Edge
    for (let i = 0; i < countPerEdge && slots.length < targetTotal; i++) {
        const x = -10 + (i * (100 / countPerEdge));
        const y = 70 + Math.random() * 15;
        slots.push({ x, y, edge: 'bottom' });
    }

    // Left Edge
    for (let i = 0; i < countPerEdge && slots.length < targetTotal; i++) {
        const x = -5 + Math.random() * 10;
        const y = 2 + (i * (80 / countPerEdge));
        slots.push({ x, y, edge: 'left' });
    }

    // Right Edge
    while (slots.length < targetTotal) {
        const i = slots.length % countPerEdge;
        const x = 75 + Math.random() * 15;
        const y = 8 + (i * (80 / countPerEdge));
        slots.push({ x, y, edge: 'right' });
    }

    // 4. Place Animals
    roster.forEach((animal, index) => {
        if (index >= slots.length) return;
        const slot = slots[index];
        
        const img = document.createElement('img');
        img.src = `/animal_images/${animal}.png`;
        img.className = 'plush-bg-item';
        img.dataset.animal = animal;
        
        img.style.left = slot.x + 'vw';
        img.style.top = slot.y + 'vh';
        
        // Immersive Overlap logic: ONLY SIDE TOYS can overlap
        let onTopProb = 0;
        if (slot.edge === 'left' || slot.edge === 'right') {
            onTopProb = 0.45;
        }
        img.style.zIndex = Math.random() < onTopProb ? 20 : 5;
        
        const scale = 0.8 + Math.random() * 0.5;
        const rotation = Math.floor(Math.random() * 70) - 35;
        img.style.transform = `rotate(${rotation}deg) scale(${scale})`;
        
        img.addEventListener('click', () => {
            playAnimalSound(animal);
            highlightAnimal(animal, 3000);
        });
        
        plushMountain.appendChild(img);
    });
}

// 2. Disable right-click for toddler-proofing
document.addEventListener('contextmenu', (e) => e.preventDefault());

// 3. Start Button Logic
startButton.addEventListener('click', async () => {
    try {
        // Request Webcam
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: 'user',
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false 
        });
        
        webcamElement.srcObject = stream;
        
        // Transition from splash to camera
        webcamElement.onloadedmetadata = () => {
            webcamElement.classList.add('active');
            startScreen.classList.add('hidden');
            // Start the capture loop
            startAutoCapture();
        };

    } catch (error) {
        console.error('Permission denied or error starting:', error);
        alert('Please allow webcam access to play!');
    }
});

const timerCount = document.getElementById('timer-count');
const timerContainer = document.getElementById('timer-container');

let captureTimer = null;
let secondsRemaining = 0;

// 4. Capture and Analyze
async function startAutoCapture() {
    // Hidden initially, show when capture starts
    timerContainer.style.display = 'flex';
    
    const initialDelay = 4000; // 4s initial delay
    await runCountdown(initialDelay / 1000);
    captureImage();
}

async function runCountdown(seconds) {
    secondsRemaining = seconds;
    updateTimerUI();
    
    return new Promise((resolve) => {
        if (captureTimer) clearInterval(captureTimer);
        
        captureTimer = setInterval(() => {
            secondsRemaining--;
            updateTimerUI();
            
            if (secondsRemaining <= 0) {
                clearInterval(captureTimer);
                resolve();
            }
        }, 1000);
    });
}

function updateTimerUI() {
    if (secondsRemaining >= 0) {
        timerCount.innerText = secondsRemaining;
        // Visual feedback
        timerCount.classList.remove('pulse-timer');
        void timerCount.offsetWidth; // trigger reflow
        timerCount.classList.add('pulse-timer');
    }
}

async function captureImage() {
    if (!webcamElement.srcObject) {
        console.warn('Webcam stream not active, stopping capture.');
        return;
    }

    const badge = document.getElementById('brain-badge');
    if (badge) badge.classList.remove('active');

    // Flash effect
    const flash = document.createElement('div');
    flash.className = 'magic-flash';
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 500);

    const canvas = document.createElement('canvas');
    canvas.width = webcamElement.videoWidth;
    canvas.height = webcamElement.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(webcamElement, 0, 0, canvas.width, canvas.height);

    const imageData = canvas.toDataURL('image/jpeg', 0.8); // Use 0.8 quality for JPEG

    try {
        const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ base64_image: imageData }) // Changed key to base64_image as per original analyzeFrame
        });

        const data = await response.json();
        console.log('Analysis result:', data);

        const badge = document.getElementById('brain-badge');
        if (badge) {
            if (data.animal === 'unknown') {
                badge.textContent = 'Searching... 🕵️';
            } else if (data.method) {
                const methodLabel = data.method === 'yolo' ? 'YOLO 🏎️' : 'Gemini ✨';
                badge.textContent = methodLabel;
            }
            badge.classList.add('active');
        }

        let nextDelay = 4000; // Default: retry in 4s if unknown

        if (data.animal && data.animal !== "unknown" && animalConfig[data.animal]) { // Added animalConfig check
            handleSuccess(data.animal);
            highlightAnimal(data.animal, 15000); // Added highlightAnimal call
            nextDelay = 8000; // Success: wait 8s
        }

        // Wait then repeat
        await runCountdown(nextDelay / 1000);
        captureImage();
        
    } catch (error) {
        console.error('Analysis failed:', error);
        await runCountdown(4); // Error: retry in 4s
        captureImage();
    }
}

// 5. Feedback Logic
function handleSuccess(animal) {
    playAnimalSound(animal);
    
    // Trigger Magic Flash in frame
    magicOverlay.classList.remove('flash-active');
    void magicOverlay.offsetWidth; // Trigger reflow
    magicOverlay.classList.add('flash-active');

    showNameAnimation(animal);
}

function playAnimalSound(animal) {
    const paths = animalConfig[animal];
    if (!paths || paths.length === 0) return;
    
    const randomPath = paths[Math.floor(Math.random() * paths.length)];
    const audio = new Audio(randomPath);
    audio.play();
}

function showNameAnimation(animal) {
    animalNameContainer.textContent = animal;
    animalNameContainer.classList.remove('pop-anim');
    void animalNameContainer.offsetWidth; // Trigger reflow
    animalNameContainer.classList.add('pop-anim');
}

// 6. Highlight background items
function highlightAnimal(animal, duration) {
    const items = document.querySelectorAll(`.plush-bg-item[data-animal="${animal}"]`);
    items.forEach(item => item.classList.add('celebrate'));
    
    setTimeout(() => {
        items.forEach(item => item.classList.remove('celebrate'));
    }, duration);
}

// Initialize on load
window.addEventListener('load', init);
