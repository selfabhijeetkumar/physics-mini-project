document.addEventListener("DOMContentLoaded", () => {
    // --- DOM Elements ---
    // Controls
    const lengthSlider = document.getElementById("length-slider");
    const lenVal = document.getElementById("length-val");
    const gravitySlider = document.getElementById("gravity-slider");
    const gravVal = document.getElementById("gravity-val");
    const angleSlider = document.getElementById("angle-slider");
    const angleVal = document.getElementById("angle-val");
    const angleWarning = document.getElementById("angle-warning");
    
    const presetBtns = document.querySelectorAll(".preset-btn");
    
    const playPauseBtn = document.getElementById("play-pause-btn");
    const resetBtn = document.getElementById("reset-btn");
    
    const dampingToggle = document.getElementById("damping-toggle");
    const trailToggle = document.getElementById("trail-toggle");
    const speedSelect = document.getElementById("speed-select");

    // Data Displays
    const calcT = document.getElementById("calc-t");
    const calcF = document.getElementById("calc-f");
    const calcW = document.getElementById("calc-w");

    const dynAngle = document.getElementById("dyn-angle");
    const dynOmega = document.getElementById("dyn-omega");
    const dynMax = document.getElementById("dyn-max");
    const dynTime = document.getElementById("dyn-time");

    const dynPe = document.getElementById("dyn-pe");
    const dynKe = document.getElementById("dyn-ke");
    const dynTotalE = document.getElementById("dyn-total-e");
    const peBar = document.getElementById("pe-bar");
    const keBar = document.getElementById("ke-bar");

    // Canvas
    const canvas = document.getElementById("sim-canvas");
    const ctx = canvas.getContext("2d");

    // --- State Variables ---
    let L = parseFloat(lengthSlider.value);
    let g = parseFloat(gravitySlider.value);
    let initialAngleDeg = parseFloat(angleSlider.value);
    
    let isRunning = false;
    let dampingFactor = 0.999;
    let hasDamping = dampingToggle.checked;
    let showTrail = trailToggle.checked;
    let speedMult = parseFloat(speedSelect.value);

    // Physics variables
    let theta = initialAngleDeg * Math.PI / 180;
    let omega = 0;
    let alpha = 0;
    let elapsedTime = 0;
    const mass = 1.0; // kg

    // Trail buffer
    const maxTrailPoints = 50;
    let trail = [];

    // Animation Loop Variables
    let lastTimestamp = 0;
    let animReq;

    // --- Initialization & Resizing ---
    function resizeCanvas() {
        // Find container to size explicitly
        const container = canvas.parentElement;
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight || 400; // minimum height
        draw();
    }
    
    window.addEventListener("resize", resizeCanvas);

    // --- Core Physics & Logic ---
    function getDerivedValues() {
        const T = 2 * Math.PI * Math.sqrt(L / g);
        const f = 1 / T;
        const w = 2 * Math.PI / T;
        return { T, f, w };
    }

    function updateCalculationsUI() {
        const { T, f, w } = getDerivedValues();
        calcT.innerText = T.toFixed(2);
        calcF.innerText = f.toFixed(2);
        calcW.innerText = w.toFixed(2);
        dynMax.innerText = initialAngleDeg.toFixed(2);
    }

    function updateDynamicUI() {
        let currentDeg = (theta * 180 / Math.PI);
        
        // Normalize angle for display (-180 to 180)
        while (currentDeg > 180) currentDeg -= 360;
        while (currentDeg < -180) currentDeg += 360;

        dynAngle.innerText = currentDeg.toFixed(2);
        dynOmega.innerText = omega.toFixed(2);
        dynTime.innerText = elapsedTime.toFixed(2);

        // Energy calculations (m = 1kg)
        // PE = mgh = mg * L * (1 - cos(theta)) 
        // KE = 0.5 * m * v^2 = 0.5 * m * (L * omega)^2
        const h = L * (1 - Math.cos(theta));
        let pe = mass * g * h;
        let pVelocity = L * omega;
        let ke = 0.5 * mass * pVelocity * pVelocity;
        let total = pe + ke;

        // Note: Due to Euler integration, energy may drift slightly.
        // We can just plot what the values currently are.
        dynPe.innerText = pe.toFixed(2);
        dynKe.innerText = ke.toFixed(2);
        dynTotalE.innerText = total.toFixed(2);

        // Update Energy Bars
        const maxEnergy = mass * g * L * (1 - Math.cos(initialAngleDeg * Math.PI / 180));
        let pePct = maxEnergy > 0 ? (pe / maxEnergy) * 100 : 0;
        let kePct = maxEnergy > 0 ? (ke / maxEnergy) * 100 : 0;
        
        peBar.style.width = Math.min(pePct, 100) + "%";
        keBar.style.width = Math.min(kePct, 100) + "%";
    }

    // --- Rendering ---
    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const cx = canvas.width / 2;
        const cy = 40; // Top pivot margin
        
        // Convert physics length (0.1 to 10m) to pixel length
        // Let maximum pendulum length (10m) fit within a reasonable scale
        // Canvas height minus padding is roughly allowable area
        const maxPxLength = canvas.height - cy - 40;
        const scaleFactor = maxPxLength / 10; 
        const pxLength = L * scaleFactor;

        // Current Bob Position
        const bobX = cx + pxLength * Math.sin(theta);
        const bobY = cy + pxLength * Math.cos(theta);

        // Draw Reference Elements
        // 1. Arc / Angle Indicators
        ctx.beginPath();
        ctx.strokeStyle = "rgba(255,255,255,0.2)";
        ctx.lineWidth = 1;
        ctx.arc(cx, cy, pxLength, 0, Math.PI);
        ctx.stroke();

        // 2. Vertical Line
        ctx.beginPath();
        ctx.strokeStyle = "rgba(255,255,255,0.1)";
        ctx.setLineDash([5, 5]);
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx, cy + pxLength + 20);
        ctx.stroke();
        ctx.setLineDash([]);

        // Record Trail Point
        if (isRunning && showTrail) {
            trail.push({ x: bobX, y: bobY });
            if (trail.length > maxTrailPoints) trail.shift();
        } else if (!showTrail) {
            trail = [];
        }

        // Draw Trail
        if (showTrail && trail.length > 1) {
            ctx.beginPath();
            ctx.strokeStyle = "rgba(0, 212, 255, 0.5)"; // Cyan fading
            ctx.lineWidth = 2;
            ctx.moveTo(trail[0].x, trail[0].y);
            for (let i = 1; i < trail.length; i++) {
                ctx.lineTo(trail[i].x, trail[i].y);
            }
            ctx.stroke();
        }

        // Draw Rod
        ctx.beginPath();
        // gradient rod
        let rodGrad = ctx.createLinearGradient(cx, cy, bobX, bobY);
        rodGrad.addColorStop(0, "rgba(200,200,200,0.8)");
        rodGrad.addColorStop(1, "rgba(100,100,100,0.4)");
        ctx.strokeStyle = rodGrad;
        ctx.lineWidth = 4;
        ctx.moveTo(cx, cy);
        ctx.lineTo(bobX, bobY);
        ctx.stroke();

        // Draw Bob
        const bobRadius = 15;
        // Drop shadow for depth
        ctx.shadowColor = "rgba(0,0,0,0.6)";
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 5;
        ctx.shadowOffsetY = 5;

        ctx.beginPath();
        ctx.arc(bobX, bobY, bobRadius, 0, Math.PI * 2);
        
        let bobGrad = ctx.createRadialGradient(bobX - bobRadius/3, bobY - bobRadius/3, 2, bobX, bobY, bobRadius);
        bobGrad.addColorStop(0, "#ffe866"); // warm gold highlight
        bobGrad.addColorStop(0.5, "#ffd700"); // mid gold
        bobGrad.addColorStop(1, "#c4a300"); // shadow gold
        
        ctx.fillStyle = bobGrad;
        ctx.fill();

        ctx.lineWidth = 1;
        ctx.strokeStyle = "#806c00";
        ctx.stroke();

        // Reset shadow
        ctx.shadowColor = "transparent";

        // Draw Pivot Point
        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, Math.PI*2);
        let pivGrad = ctx.createRadialGradient(cx-2, cy-2, 1, cx, cy, 6);
        pivGrad.addColorStop(0, "#ffffff");
        pivGrad.addColorStop(1, "#555555");
        ctx.fillStyle = pivGrad;
        ctx.fill();
        ctx.strokeStyle = "#111";
        ctx.stroke();

        updateDynamicUI();
    }

    // --- Animation Loop ---
    function step(timestamp) {
        if (!lastTimestamp) lastTimestamp = timestamp;
        let delta = (timestamp - lastTimestamp) / 1000.0; // in seconds
        lastTimestamp = timestamp;

        if (isRunning) {
            // Apply Speed Multiplier
            delta *= speedMult;
            // Cap delta to prevent huge jumps
            if (delta > 0.1) delta = 0.1;

            elapsedTime += delta;

            // Physics Update (Euler Method)
            // Smaller time substeps for better accuracy
            const subSteps = 10;
            const dt = delta / subSteps;

            for (let i = 0; i < subSteps; i++) {
                alpha = -(g / L) * Math.sin(theta);
                omega += alpha * dt;
                
                if (hasDamping) {
                    // Damping applied per dt
                    omega *= Math.pow(dampingFactor, dt*60); // approximate scaling
                }
                
                theta += omega * dt;
            }
        }

        draw();
        animReq = requestAnimationFrame(step);
    }

    // --- Event Listeners ---
    function updateParamsFromUI() {
        L = parseFloat(lengthSlider.value);
        lenVal.innerText = L.toFixed(1);
        
        g = parseFloat(gravitySlider.value);
        gravVal.innerText = g.toFixed(2);
        
        initialAngleDeg = parseInt(angleSlider.value);
        angleVal.innerText = initialAngleDeg;

        if (initialAngleDeg > 45) {
            angleWarning.classList.remove("hidden");
        } else {
            angleWarning.classList.add("hidden");
        }

        hasDamping = dampingToggle.checked;
        showTrail = trailToggle.checked;
        speedMult = parseFloat(speedSelect.value);

        updateCalculationsUI();
        
        if (!isRunning) {
            // If not running, instantly update pendulum position to initial angle
            theta = initialAngleDeg * Math.PI / 180;
            omega = 0;
            elapsedTime = 0;
            trail = [];
            draw();
        }
    }

    lengthSlider.addEventListener("input", updateParamsFromUI);
    gravitySlider.addEventListener("input", updateParamsFromUI);
    angleSlider.addEventListener("input", updateParamsFromUI);
    dampingToggle.addEventListener("change", updateParamsFromUI);
    trailToggle.addEventListener("change", updateParamsFromUI);
    speedSelect.addEventListener("change", updateParamsFromUI);

    presetBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            gravitySlider.value = btn.dataset.g;
            updateParamsFromUI();
        });
    });

    playPauseBtn.addEventListener("click", () => {
        isRunning = !isRunning;
        if (isRunning) {
            playPauseBtn.innerHTML = "⏸ Pause";
            playPauseBtn.style.background = "#ff4757"; // Red for pause
            playPauseBtn.style.color = "#fff";
            lastTimestamp = performance.now();
        } else {
            playPauseBtn.innerHTML = "▶ Start";
            playPauseBtn.style.background = ""; // back to CSS default
            playPauseBtn.style.color = "";
        }
    });

    resetBtn.addEventListener("click", () => {
        isRunning = false;
        playPauseBtn.innerHTML = "▶ Start";
        playPauseBtn.style.background = "";
        playPauseBtn.style.color = "";
        
        theta = initialAngleDeg * Math.PI / 180;
        omega = 0;
        alpha = 0;
        elapsedTime = 0;
        trail = [];
        lastTimestamp = 0;
        
        draw();
    });

    // --- Init ---
    resizeCanvas(); // Will call draw()
    updateParamsFromUI();
    animReq = requestAnimationFrame(step);
});
