angular.module('jenkins.notifier', [])
	.controller('JobListController', function ($scope, $window, Jobs, Notification) {
		$scope.open = function (url) {
			$window.open(url);
		};

		$scope.Jobs = Jobs;

		Jobs.updateAllStatus();

		$scope.add = function (url) {
			Jobs.add(url).then(function () {
				$scope.url = "";
			});
		};
	})
	.service('Jobs', function (Storage, jenkins) {
		var key = {urls: {}};
		var jobNameRegExp = /.*\/job\/([^/]+)(\/.*|$)/;

		var Jobs = {
			list: {},
			add: function (url) {
				return Storage.get(key).then(function (objects) {
					var name = url.replace(jobNameRegExp, "$1");
					objects.urls[url] = objects.urls[url] || {
							name: name,
							displayName: name
						};
					return Storage.set(objects)
				}).then(function () {
					return Jobs.updateStatus(url);
				});
			},
			remove: function (url) {
				return Storage.get(key).then(function (objects) {
					delete objects.urls[url];
					return Storage.set(objects);
				});
			},
			update: function (url, data) {
				var oldValue;
				return Storage.get(key).then(function (objects) {
					oldValue = objects.urls[url];
					objects.urls[url] = data;
					return Storage.set(objects);
				}).then(function () {
					return {oldValue: oldValue, newValue: data};
				});
			},
			updateStatus: function (url) {
				return jenkins(url).then(function (data) {
					return Jobs.update(url, data);
				});
			},
			updateAllStatus: function () {
				return Storage.get(key).then(function (objects) {
					var promises = [];
					angular.forEach(objects.urls, function (_, url) {
						promises.push(Jobs.updateStatus(url));
					});
					return promises;
				});
			}
		};

		Storage.get(key).then(function (objects) {
			Jobs.list = objects.urls;
		});
		Storage.onChanged.addListener(function (objects) {
			if (objects.urls) {
				Jobs.list = objects.urls.newValue;
			}
		});

		return Jobs;
	})
	.service('jenkins', function ($http) {
		var colorToClass = {
			blue: 'success', yellow: 'warning', red: 'danger'
		};
		var status = {
			blue: 'Success', yellow: 'Unstable', red: 'Failure', notbuilt: 'Not built', disabled: 'Disabled'
		};

		return function (url) {
			var url = url.charAt(url.length - 1) === '/' ? url : url + '/';
			return $http.get(url + 'api/json/').then(function (res) {
				var data = res.data;
				var basicColor = (data.color || "").replace(/_anime$/, '');
				return {
					name: data.name,
					displayName: data.displayName,
					buildable: data.buildable,
					building: /_anime$/.test(data.color),
					status: status[basicColor] || basicColor,
					statusClass: colorToClass[basicColor],
					lastBuild: data.lastBuild || {}
				};
			});
		}
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
			onChanged: chrome.storage.onChanged,
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
