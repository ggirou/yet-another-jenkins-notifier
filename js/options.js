var refreshTimeInput = document.getElementById('refreshTime');
var refreshTimeSpan = document.getElementById('refreshTimeSpan');
var statusElement = document.getElementById('status');

// Saves options to chrome.storage.local.
function saveOptions() {
	var refreshTime = refreshTimeInput.value;

	chrome.storage.local.set({options: {refreshTime: refreshTime}}, function () {
		// Update status to let user know options were saved.
		statusElement.style.visibility = "visible";
		setTimeout(function () {
			statusElement.style.visibility = "hidden";
		}, 750);
	});
}

// Restores the preferences stored in chrome.storage.
function restoreOptions() {
	// Use default value color = 'red' and likesColor = true.
	chrome.storage.local.get({options: {refreshTime: 60}}, function (objects) {
		refreshTimeSpan.textContent = refreshTimeInput.value = objects.options.refreshTime;
	});
}

function updateRefreshTimeSpan() {
	refreshTimeSpan.textContent = refreshTimeInput.value;
}

document.addEventListener('DOMContentLoaded', restoreOptions);
refreshTimeInput.addEventListener('change', saveOptions);
refreshTimeInput.addEventListener('input', updateRefreshTimeSpan);
