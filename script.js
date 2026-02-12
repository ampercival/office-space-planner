document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('simulationForm');
    const runBtn = document.getElementById('runBtn');
    const btnText = runBtn.querySelector('.btn-text');
    const loader = runBtn.querySelector('.loader');

    // Progress UI
    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');
    const progressPercent = document.getElementById('progressPercent');
    const estimatedTime = document.getElementById('estimatedTime');

    // Set Footer Year
    document.getElementById("year").textContent = new Date().getFullYear();

    // Chart instance
    let outputChart = null;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

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

        // Reset UI
        runBtn.disabled = false;
        btnText.textContent = 'Run Monte Carlo';
        loader.classList.add('hidden');
        progressContainer.classList.add('hidden');

        // Show Results
        document.getElementById('summaryCard').classList.remove('hidden');
        document.getElementById('resultsSection').classList.remove('hidden');
    });

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
                        // We randomly pick 'daysInOffice' days from 0-4 (Mon-Fri)
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
                // Rate = ms per sim
                const rate = elapsedOverall / completedSims;
                const remainingSims = numSimulations - completedSims;
                const timeRemainingMs = rate * remainingSims;

                updateProgress(percentComplete, timeRemainingMs);

                if (completedSims < numSimulations) {
                    // Schedule next chunk
                    // Use setTimeout to yield to main thread properly
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
            // Keep it human readable
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
        // Animate numbers
        animateValue(document.getElementById('avgDailyOccupancy'), 0, Math.round(results.avgDailyOccupancy), 1000);
        animateValue(document.getElementById('avgPeakDesks'), 0, Math.round(results.avgPeak), 1000);
        animateValue(document.getElementById('p95Desks'), 0, results.p95, 1000);
        animateValue(document.getElementById('maxObserved'), 0, results.maxObserved, 1000);
    }

    function updateChart(data) {
        const ctx = document.getElementById('histogramChart').getContext('2d');

        // Process data for histogram
        const minVal = data[0];
        const maxVal = data[data.length - 1];
        const bins = {};

        // Initialize bins
        for (let i = minVal; i <= maxVal; i++) {
            bins[i] = 0;
        }

        // Count frequencies
        data.forEach(val => bins[val]++);

        const labels = Object.keys(bins);
        const frequencies = Object.values(bins);

        // Destroy previous chart if exists
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
                    legend: {
                        display: false
                    },
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
