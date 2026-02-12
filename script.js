document.addEventListener('DOMContentLoaded', () => {
    // ---- DOM Elements ----
    const form = document.getElementById('simulationForm');
    const runBtn = document.getElementById('runBtn');
    const btnText = runBtn.querySelector('.btn-text');
    const loader = runBtn.querySelector('.loader');

    // Progress UI
    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');
    const progressPercent = document.getElementById('progressPercent');
    const estimatedTime = document.getElementById('estimatedTime');

    // Custom Analysis UI
    const addCustomBtn = document.getElementById('addCustomBtn');
    const customPercentInput = document.getElementById('customPercentInput');
    const statsGrid = document.getElementById('statsGrid');

    // Header Actions
    const saveBtn = document.getElementById('saveBtn');
    const loadBtn = document.getElementById('loadBtn');
    // Note: loadInput is no longer needed

    // Set Footer Year
    document.getElementById("year").textContent = new Date().getFullYear();

    // ---- State ----
    let outputChart = null;
    let storedDistribution = null; // Store results for post-run analysis
    let storedResults = null; // Store full result object for saving
    let numSimulationsRun = 0;

    // ---- Event Listeners ----

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Reset Custom Stats Area on new run
        clearCustomStats();

        // UI Loading State
        runBtn.disabled = true;
        btnText.textContent = 'Running...';
        loader.classList.remove('hidden');
        progressContainer.classList.remove('hidden');

        // Reset Progress
        updateProgress(0, 0);

        // Allow UI to update before blocking with heavy calculation
        await new Promise(resolve => setTimeout(resolve, 50));

        const numEmployees = parseInt(document.getElementById('employees').value);
        const absenteeismRate = parseFloat(document.getElementById('absenteeism').value) / 100;
        const numSimulations = parseInt(document.getElementById('simulations').value);
        const daysInOffice = parseInt(document.getElementById('daysInOffice').value);

        // Run Monte Carlo with Chunking
        const simulationResults = await runMonteCarloAsync(numEmployees, absenteeismRate, numSimulations, daysInOffice);

        // Update Stats
        updateStats(simulationResults);

        // Update Chart
        updateChart(simulationResults.distribution);

        // Store for later
        storedDistribution = simulationResults.distribution;
        storedResults = simulationResults; // Save full object
        numSimulationsRun = numSimulations;

        // Reset UI
        runBtn.disabled = false;
        btnText.textContent = 'Run Monte Carlo';
        loader.classList.add('hidden');
        progressContainer.classList.add('hidden');

        // Show Results
        document.getElementById('summaryCard').classList.remove('hidden');
        document.getElementById('resultsSection').classList.remove('hidden');
    });

    addCustomBtn.addEventListener('click', () => {
        if (!storedDistribution) {
            alert("Please run a simulation first.");
            return;
        }

        const percent = parseFloat(customPercentInput.value);
        if (isNaN(percent) || percent <= 0 || percent >= 100) {
            alert("Please enter a valid percentage between 0 and 100.");
            return;
        }

        addCustomStat(percent);
    });

    // -- Save / Load Handlers (Modal) --

    const modalOverlay = document.getElementById('modalOverlay');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    const modalCloseBtn = document.getElementById('modalCloseBtn');
    const modalCancelBtn = document.getElementById('modalCancelBtn');
    const modalConfirmBtn = document.getElementById('modalConfirmBtn');

    let currentModalMode = null; // 'save' or 'load'

    // Load saved simulations from Storage
    function getSavedSimulations() {
        const json = localStorage.getItem('officeSpaceSimulations');
        return json ? JSON.parse(json) : [];
    }

    function saveSimulations(list) {
        localStorage.setItem('officeSpaceSimulations', JSON.stringify(list));
    }

    // Modal Controls
    function openModal(mode) {
        currentModalMode = mode;
        modalOverlay.classList.remove('hidden');

        // Reset Footer Buttons
        modalConfirmBtn.classList.remove('hidden');
        modalConfirmBtn.textContent = (mode === 'save') ? 'Save' : 'Load';

        if (mode === 'save') {
            modalTitle.textContent = "Save Simulation";
            modalConfirmBtn.onclick = handleSaveConfirm;

            // Generate default name
            const dateStr = new Date().toISOString().slice(0, 10);
            const employees = document.getElementById('employees').value;
            const defaultName = `Sim ${dateStr} - ${employees} Staff`;

            modalBody.innerHTML = `
               <label for="saveNameInput" style="display:block; margin-bottom:0.5rem; font-weight:600;">Name this simulation:</label>
               <input type="text" id="saveNameInput" class="full-width-input" value="${defaultName}" />
           `;
            setTimeout(() => document.getElementById('saveNameInput').focus(), 100);

        } else if (mode === 'load') {
            modalTitle.textContent = "Load Simulation";
            modalConfirmBtn.classList.add('hidden'); // Hide confirm, list items are clickable
            renderLoadList();
        }
    }

    function closeModal() {
        modalOverlay.classList.add('hidden');
        currentModalMode = null;
    }

    function renderLoadList() {
        const list = getSavedSimulations();
        if (list.length === 0) {
            modalBody.innerHTML = '<p style="color:var(--text-muted); text-align:center;">No saved simulations found.</p>';
            return;
        }

        modalBody.innerHTML = '';
        const ul = document.createElement('div');

        // Sort by date new -> old
        list.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        list.forEach((sim, index) => {
            const item = document.createElement('div');
            item.className = 'saved-sim-item';

            const dateDisplay = new Date(sim.timestamp).toLocaleString();

            item.innerHTML = `
                <div class="sim-info">
                    <span class="sim-name">${sim.name}</span>
                    <span class="sim-date">${dateDisplay}</span>
                </div>
                <button class="delete-btn" title="Delete" data-index="${index}">&times;</button>
            `;

            // Click to Load
            item.onclick = (e) => {
                if (e.target.classList.contains('delete-btn')) return;
                loadSimulationData(sim.data);
                closeModal();
                showToast("Simulation Loaded!");
            };

            // Delete Handler
            const delBtn = item.querySelector('.delete-btn');
            delBtn.onclick = (e) => {
                e.stopPropagation();
                if (confirm(`Delete "${sim.name}"?`)) {
                    // Need to find unique item to delete since index shifts
                    // We rely on timestamp as unique ID here
                    deleteSimulation(sim.timestamp);
                }
            };

            ul.appendChild(item);
        });

        modalBody.appendChild(ul);
    }

    function deleteSimulation(timestamp) {
        let list = getSavedSimulations();
        list = list.filter(s => s.timestamp !== timestamp);
        saveSimulations(list);
        renderLoadList();
    }

    function handleSaveConfirm() {
        const nameInput = document.getElementById('saveNameInput');
        const name = nameInput.value.trim() || "Untitled Simulation";

        const newSim = {
            name: name,
            timestamp: new Date().toISOString(),
            data: {
                inputs: {
                    employees: document.getElementById('employees').value,
                    daysInOffice: document.getElementById('daysInOffice').value,
                    absenteeism: document.getElementById('absenteeism').value,
                    simulations: document.getElementById('simulations').value
                },
                results: storedResults
            }
        };

        const list = getSavedSimulations();
        list.push(newSim);
        saveSimulations(list);

        closeModal();
        showToast("Simulation Saved!");
    }

    function loadSimulationData(data) {
        if (!data || !data.results || !data.results.distribution) return;

        // Restore Inputs
        if (data.inputs) {
            document.getElementById('employees').value = data.inputs.employees || 1000;
            document.getElementById('daysInOffice').value = data.inputs.daysInOffice || 4;
            document.getElementById('absenteeism').value = data.inputs.absenteeism || 15;
            document.getElementById('simulations').value = data.inputs.simulations || 10000;
        }

        // Restore State
        storedResults = data.results;
        storedDistribution = data.results.distribution;
        numSimulationsRun = storedDistribution.length;

        // Update UI
        clearCustomStats();
        updateStats(storedResults);
        updateChart(storedDistribution);

        document.getElementById('summaryCard').classList.remove('hidden');
        document.getElementById('resultsSection').classList.remove('hidden');
    }

    function showToast(msg) {
        const status = document.getElementById('saveStatus');
        status.textContent = msg;
        status.style.opacity = 1;
        setTimeout(() => { status.style.opacity = 0; }, 2000);
    }

    // Modal Event Listeners
    modalCloseBtn.onclick = closeModal;
    modalCancelBtn.onclick = closeModal;
    modalOverlay.onclick = (e) => {
        if (e.target === modalOverlay) closeModal();
    };

    // Main Buttons
    saveBtn.addEventListener('click', () => {
        if (!storedResults) {
            alert("Please run a simulation first.");
            return;
        }
        openModal('save');
    });

    loadBtn.addEventListener('click', () => {
        openModal('load');
    });

    // ---- Functions ----

    async function runMonteCarloAsync(numEmployees, absenteeismRate, numSimulations, daysInOffice) {
        return new Promise(async (resolve) => {
            const peakDesksDistribution = [];
            let totalPeakDesks = 0;
            let totalDailyOccupancy = 0;

            const CHUNK_SIZE = 500; // Simulations per frame
            let completedSims = 0;
            const startTime = performance.now();

            const processChunk = () => {
                const chunkStart = performance.now();
                const limit = Math.min(completedSims + CHUNK_SIZE, numSimulations);

                for (let i = completedSims; i < limit; i++) {
                    const dailyCounts = [0, 0, 0, 0, 0];

                    for (let emp = 0; emp < numEmployees; emp++) {
                        // Determine scheduled days for this employee
                        const scheduledDays = getRandomDays(daysInOffice);

                        for (let day of scheduledDays) {
                            // On a scheduled day, check if they show up (not absent)
                            if (Math.random() >= absenteeismRate) {
                                dailyCounts[day]++;
                            }
                        }
                    }

                    const maxOccupancy = Math.max(...dailyCounts);
                    peakDesksDistribution.push(maxOccupancy);
                    totalPeakDesks += maxOccupancy;
                    totalDailyOccupancy += (dailyCounts.reduce((a, b) => a + b, 0) / 5);
                }

                completedSims = limit;

                // Update Progress
                const now = performance.now();
                const elapsedOverall = now - startTime;
                const percentComplete = completedSims / numSimulations;

                // Estimate remaining time
                const rate = elapsedOverall / completedSims;
                const remainingSims = numSimulations - completedSims;
                const timeRemainingMs = rate * remainingSims;

                updateProgress(percentComplete, timeRemainingMs);

                if (completedSims < numSimulations) {
                    setTimeout(processChunk, 0);
                } else {
                    // Verify sorting and stats
                    peakDesksDistribution.sort((a, b) => a - b);

                    resolve({
                        distribution: peakDesksDistribution,
                        avgDailyOccupancy: totalDailyOccupancy / numSimulations,
                        avgPeak: totalPeakDesks / numSimulations,
                        maxObserved: peakDesksDistribution[peakDesksDistribution.length - 1],
                        p95: peakDesksDistribution[Math.floor(numSimulations * 0.95)]
                    });
                }
            };

            // Start the first chunk
            processChunk();
        });
    }

    // Helper to pick N unique random days from [0, 1, 2, 3, 4]
    function getRandomDays(n) {
        if (n <= 0) return [];
        if (n >= 5) return [0, 1, 2, 3, 4];

        // Fisher-Yates Shuffle for efficiency
        const days = [0, 1, 2, 3, 4];
        for (let i = days.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [days[i], days[j]] = [days[j], days[i]];
        }
        return days.slice(0, n);
    }

    function updateProgress(percent, remainingMs) {
        const p = Math.min(Math.round(percent * 100), 100);
        progressBar.style.width = `${p}%`;
        progressPercent.textContent = `${p}%`;

        if (remainingMs > 0) {
            let timeStr = '';
            if (remainingMs < 1000) {
                timeStr = '< 1s remaining';
            } else {
                const seconds = Math.ceil(remainingMs / 1000);
                timeStr = `~${seconds}s remaining`;
            }
            estimatedTime.textContent = timeStr;
        } else {
            estimatedTime.textContent = 'Finishing up...';
        }
    }

    function updateStats(results) {
        animateValue(document.getElementById('avgDailyOccupancy'), 0, Math.round(results.avgDailyOccupancy), 1000);
        animateValue(document.getElementById('avgPeakDesks'), 0, Math.round(results.avgPeak), 1000);
        animateValue(document.getElementById('p95Desks'), 0, results.p95, 1000);
        animateValue(document.getElementById('maxObserved'), 0, results.maxObserved, 1000);
    }

    function addCustomStat(percent) {
        // percentile index = Floor(total * (percent/100))
        let index = Math.floor(numSimulationsRun * (percent / 100));
        index = Math.max(0, Math.min(index, numSimulationsRun - 1));

        const value = storedDistribution[index];

        // Create HTML element
        const div = document.createElement('div');
        div.className = 'stat-item custom-stat';
        div.style.borderColor = 'var(--primary)'; // Highlight custom ones
        div.innerHTML = `
            <span class="stat-label">Recommended Desks (${percent}%)</span>
            <span class="stat-value">${value}</span>
            <small>Covers ${percent}% of scenarios</small>
        `;

        statsGrid.appendChild(div);

        // Scroll to it
        div.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function clearCustomStats() {
        // Remove all elements with class 'custom-stat'
        const customs = document.querySelectorAll('.custom-stat');
        customs.forEach(el => el.remove());
    }

    function updateChart(data) {
        const ctx = document.getElementById('histogramChart').getContext('2d');
        const minVal = data[0];
        const maxVal = data[data.length - 1];
        const bins = {};

        for (let i = minVal; i <= maxVal; i++) {
            bins[i] = 0;
        }

        data.forEach(val => bins[val]++);

        const labels = Object.keys(bins);
        const frequencies = Object.values(bins);

        if (outputChart) {
            outputChart.destroy();
        }

        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(79, 70, 229, 0.8)');
        gradient.addColorStop(1, 'rgba(236, 72, 153, 0.2)');

        outputChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Simulations',
                    data: frequencies,
                    backgroundColor: gradient,
                    borderRadius: 4,
                    borderWidth: 0,
                    barPercentage: 0.9,
                    categoryPercentage: 1.0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#111827',
                        padding: 12,
                        titleFont: { size: 14, family: "'Outfit', sans-serif" },
                        bodyFont: { size: 13, family: "'Outfit', sans-serif" },
                        callbacks: {
                            title: (items) => `Desks Needed: ${items[0].label}`,
                            label: (item) => `${item.raw} Simulations`
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Number of Desks Needed',
                            color: '#6b7280',
                            font: { family: "'Outfit', sans-serif" }
                        },
                        grid: { display: false }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Frequency',
                            color: '#6b7280',
                            font: { family: "'Outfit', sans-serif" }
                        },
                        grid: { color: '#f3f4f6' },
                        beginAtZero: true
                    }
                },
                animation: {
                    duration: 1000,
                    easing: 'easeOutQuart'
                }
            }
        });
    }

    function animateValue(obj, start, end, duration) {
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            obj.innerHTML = Math.floor(progress * (end - start) + start);
            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };
        window.requestAnimationFrame(step);
    }
});
