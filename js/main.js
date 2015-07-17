angular.module('jenkins.notifier', [])
	.controller('JobListController', function ($scope, $window, Jobs, Notification) {
		$scope.open = function (url) {
			$window.open(url);
		};

		// http://localhost:8080/job/my_job/lastBuild/api/json
		// SUCCESS, UNSTABLE, FAILURE
		// blue, yellow, red, notbuilt, disabled
		// blue_anime, ...

		Jobs.list().then(function (jobs) {
			$scope.jobs = jobs;
		});

		Notification.create(null, {
				type: "basic",
				title: "Build Failed! - my_job",
				message: "http://localhost:8080/job/my_job/",
				iconUrl: "img/logo.svg"
			},
			{
				onClicked: function () {
					window.open("http://localhost:8080/job/my_job/");
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
	.service('Jobs', function (Storage) {
		return {
			list: function () {
				return Storage.get("urls").then(function (objects) {
					return Object.keys(objects.urls || {});
				});
			},
			add: function (url) {
				return Storage.get("urls").then(function (objects) {
					objects.urls = objects.urls || {};
					objects.urls[url] = {};
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
			delete Listeners[notificationId];
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
