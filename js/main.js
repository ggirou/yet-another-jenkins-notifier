function nop() {
}

function httpGet(url) {
	var callbacks = {
		success: nop,
		failure: nop
	};
	var req = new XMLHttpRequest();
	req.open('GET', url, true);
	req.onreadystatechange = function () {
		if (req.readyState == 4) {
			if (req.status == 200)
				callbacks.success(req.responseText);
			else
				callbacks.failure("Jenkins url unreachable!");
		}
	};
	req.send(null);
	return callbacks;
}

function notify() {
	chrome.notifications.create(null, {
		type: "basic",
		title: "Build Failed! - PSO03_nodeBIA",
		message: "http://ottawa.swisslife.lan:8080/job/PSO03_nodeBIA/",
		iconUrl: "img/logo.svg"
	}, function (notificationId) {
		chrome.notifications.onClicked.addListener(function (clickedNotificationId) {
			if (notificationId === clickedNotificationId) {
				window.open("http://ottawa.swisslife.lan:8080/job/PSO03_nodeBIA/");
			}
		});
	});
}
/*
 function submit() {
 var url = document.querySelector("#url").value;
 storage.addUrl(url);
 return false;
 }*/

document.addEventListener('DOMContentLoaded', function () {
	/*	document.querySelector("#url").value = "gfezgrez";
	 submit();

	 //http://ottawa.swisslife.lan:8080/job/PSO03_nodeBIA/lastBuild/api/json
	 storage.getAllUrls(function (urls) {
	 console.log(urls);
	 });
	 storage.addUrl("http://ottawa.swisslife.lan:8080/job/PSO03_nodeBIA/", function () {
	 storage.getAllUrls(function (urls) {
	 console.log(urls);
	 });
	 });
	 notify();

	 var res = httpGet('http://ottawa.swisslife.lan:8080/job/PSO03_nodeBIA/lastBuild/api/json');
	 res.success = function (data) {
	 console.log(JSON.parse(data));
	 };*/

	/*getCurrentTabUrl(function(url) {
	 // Put the image URL in Google search.
	 renderStatus('Performing Google Image search for ' + url);

	 getImageUrl(url, function(imageUrl, width, height) {

	 renderStatus('Search term: ' + url + '\n' +
	 'Google image search result: ' + imageUrl);
	 var imageResult = document.getElementById('image-result');
	 // Explicitly set the width/height to minimize the number of reflows. For
	 // a single image, this does not matter, but if you're going to embed
	 // multiple external images in your page, then the absence of width/height
	 // attributes causes the popup to resize multiple times.
	 imageResult.width = width;
	 imageResult.height = height;
	 imageResult.src = imageUrl;
	 imageResult.hidden = false;

	 }, function(errorMessage) {
	 renderStatus('Cannot display image. ' + errorMessage);
	 });
	 });*/
});


angular.module('jenkins.notifier', [])
	.controller('JobListController', function ($scope, Jobs, Notification) {
		Notification.create(null, {
				type: "basic",
				title: "Build Failed! - PSO03_nodeBIA",
				message: "http://ottawa.swisslife.lan:8080/job/PSO03_nodeBIA/",
				iconUrl: "img/logo.svg"
			},
			{
				onClicked: function () {
					window.open("http://ottawa.swisslife.lan:8080/job/PSO03_nodeBIA/");
				}
			}
		);

		$scope.submit = function () {
			Jobs.add($scope.url).then(function () {
				$scope.url = "";
				Jobs.list().then(function (urls) {
					console.log(urls);
				});
			});
		}
	})
	.
	service('Jobs', function (Storage) {
		return {
			list: function () {
				return Storage.get("urls").then(function (objects) {
					return Object.keys(objects.urls || {});
				});
			},
			add: function (url) {
				return Storage.get("urls").then(function (objects) {
					objects.urls = objects.urls || {};
					objects.urls[url] = null;
					return Storage.set(objects);
				});
			},
			remove: function (url) {
				return Storage.get("urls").then(function (objects) {
					objects.urls = objects.urls || {};
					delete objects.urls[url];
					return Storage.set(objects);
				});
			}
		};
	})
	.service('Storage', function ($q) {
		var storage = chrome.storage.local;

		function promisedCallback(deferred) {
			return function (data) {
				if (chrome.runtime.lastError) {
					deferred.reject(runtime.lastError);
				} else {
					deferred.resolve(data);
				}
			};
		}

		return {
			get: function (keys) {
				var deferred = $q.defer();
				storage.get(keys, promisedCallback(deferred));
				return deferred.promise;
			},
			set: function (objects) {
				var deferred = $q.defer();
				storage.set(objects, promisedCallback(deferred));
				return deferred.promise;
			}
		};
	})
	.service('Notification', function ($q) {
		var notifications = chrome.notifications;
		var Listeners = {};

		notifications.onClicked.addListener(function (notificationId) {
			var listener = Listeners[notificationId] || {};
			if (angular.isFunction(listener.onClicked)) {
				listener.onClicked();
			}
		});

		notifications.onClosed.addListener(function (notificationId) {
			var listener = Listeners[notificationId] || {};
			if (angular.isFunction(listener.onClosed)) {
				listener.onClosed();
			}
			//delete Listeners[notificationId];
		});

		return {
			create: function (notificationId, options, listeners) {
				var deferred = $q.defer();
				notifications.create(notificationId, options, deferred.resolve);
				return deferred.promise.then(function (notificationId) {
					Listeners[notificationId] = listeners;
					return notificationId;
				});
			}
		};
	})
;
