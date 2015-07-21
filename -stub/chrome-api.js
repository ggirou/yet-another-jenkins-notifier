chrome = chrome || {};
chrome.runtime = chrome.runtime || {};
chrome.notifications = chrome.notifications || {
		onClicked: {
			addListener: function () {
			}
		},
		onClosed: {
			addListener: function () {
			}
		},
		create: function (notificationId, options, callback) {
			if (Notification.permission !== "granted")
				Notification.requestPermission();

			new Notification(options.title, {
				icon: "img/icon48.png",
				body: options.message
			});

			callback(notificationId || new Date().getTime());
		}
	};
chrome.storage = chrome.storage || {
		onChanged: {
			addListener: function () {
			}
		}
	};
chrome.storage.local = chrome.storage.local || {
		get: function (keys, callback) {
			callback(JSON.parse(localStorage.getItem("storage")) || {});
		},
		set: function (objects, callback) {
			localStorage.setItem("storage", JSON.stringify(objects));
			callback();
		}
	};
