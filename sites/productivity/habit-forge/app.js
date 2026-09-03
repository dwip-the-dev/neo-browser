// Habit Forge Client Runtime Engine
let actionCount = 0;

document.addEventListener('DOMContentLoaded', () => {
    const primaryInput = document.getElementById('primary-input');
    const primaryActionBtn = document.getElementById('primary-action-btn');
    const resetBtn = document.getElementById('reset-btn');
    const consoleOutput = document.getElementById('console-output');
    const metricLatency = document.getElementById('metric-latency');
    const metricState = document.getElementById('metric-state');
    const metricCounter = document.getElementById('metric-counter');

    function appendLog(msg, type = '') {
        const line = document.createElement('span');
        line.className = `console-line ${type}`;
        const timestamp = new Date().toLocaleTimeString();
        line.textContent = `[${timestamp}] ${msg}`;
        consoleOutput.appendChild(line);
        consoleOutput.scrollTop = consoleOutput.scrollHeight;
    }

    function handleAction() {
        const val = (primaryInput.value || '').trim();
        actionCount++;
        if (metricCounter) metricCounter.textContent = actionCount;

        // Simulate micro-latency
        const lat = Math.floor(Math.random() * 8) + 3;
        if (metricLatency) metricLatency.textContent = `${lat}ms`;
        if (metricState) metricState.textContent = 'Processing';

        setTimeout(() => {
            if (metricState) metricState.textContent = 'Active';
            if (val) {
                appendLog(`Executed command: "${val}"`, 'success');
                primaryInput.value = '';
            } else {
                appendLog(`Triggered automated benchmark cycle #${actionCount}`, 'success');
            }
        }, lat * 4);
    }

    if (primaryActionBtn) {
        primaryActionBtn.addEventListener('click', handleAction);
    }

    if (primaryInput) {
        primaryInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleAction();
        });
    }

    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            actionCount = 0;
            if (metricCounter) metricCounter.textContent = '0';
            if (metricState) metricState.textContent = 'Ready';
            consoleOutput.innerHTML = `
                <span class="console-line system">[system] Session reset successfully.</span>
                <span class="console-line">[ready] Standing by for new instructions.</span>
            `;
        });
    }
});
