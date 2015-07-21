NodeList.prototype.forEach = Array.prototype.forEach;

var refreshTimeInput = document.getElementById('refreshTime');
var refreshTimeSpan = document.getElementById('refreshTimeSpan');
var refreshTimeFieldset = document.getElementById('refreshTimeFieldset');
var statusElement = document.getElementById('status');

var defaultOptions = {
	refreshTime: 60,
	notification: 'all'
};

// Saves options to chrome.storage.local.
function saveOptions() {
	var options = {
		refreshTime: refreshTimeInput.value,
		notification: document.querySelector('[name=notification]:checked').value
	};
	refreshTimeFieldset.disabled = options.notification === 'none';
	chrome.storage.local.set({options: options}, function () {
		// Update status to let user know options were saved.
		statusElement.style.visibility = "visible";
		setTimeout(function () {
			statusElement.style.visibility = "hidden";
		}, 1000);
	});
}

// Restores the preferences stored in chrome.storage.
function restoreOptions() {
	chrome.storage.local.get({options: defaultOptions}, function (objects) {
		var options = objects.options;
		document.querySelector('[name=notification]:checked').checked = false;
		document.querySelector('[name=notification][value="' + options.notification + '"]').checked = true;
		refreshTimeFieldset.disabled = options.notification === 'none';
		refreshTimeSpan.textContent = refreshTimeInput.value = options.refreshTime;
	});
}

function updateRefreshTimeSpan() {
	refreshTimeSpan.textContent = refreshTimeInput.value;
}

document.addEventListener('DOMContentLoaded', restoreOptions);
document.querySelectorAll('input').forEach(function (element) {
	element.addEventListener('change', saveOptions);
});
refreshTimeInput.addEventListener('input', updateRefreshTimeSpan);
