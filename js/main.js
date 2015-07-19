angular.module('jenkins.notifier', [])
	.controller('JobListController', function ($scope, $window, Jobs) {
		$scope.jobs = Jobs.list;

		Jobs.updateAllStatus();

		$scope.add = function (url) {
			Jobs.add(url).then(function () {
				$scope.url = "";
			}).then(function () {
				return Jobs.updateStatus(url);
			});
		};

		$scope.remove = Jobs.remove;

		$scope.open = function (url) {
			$window.open(url);
		};
	})
	.service('Jobs', function ($rootScope, Storage, jenkins) {
		var key = {urls: {}};
		var jobNameRegExp = /.*\/job\/([^/]+)(\/.*|$)/;

		var initialize = Storage.get(key);

		initialize.then(function (objects) {
			angular.copy(objects.urls, Jobs.list);
		});

		Storage.onChanged.addListener(function (objects) {
			if (objects.urls) {
				$rootScope.$apply(function () {
					angular.copy(objects.urls.newValue, Jobs.list);
				});
			}
		});

		function defaultData(url) {
			var name = url.replace(jobNameRegExp, "$1");
			return {
				name: name,
				displayName: name
			};
		}

		var Jobs = {
			list: {},
			add: function (url, data) {
				var oldValue, newValue;
				return initialize.then(function () {
					oldValue = Jobs.list[url];
					newValue = Jobs.list[url] = data || Jobs.list[url] || defaultData(url);
					return Storage.set({urls: Jobs.list});
				}).then(function () {
					return {oldValue: oldValue, newValue: newValue};
				});
			},
			remove: function (url) {
				return initialize.then(function () {
					delete Jobs.list[url];
					return Storage.set({urls: Jobs.list});
				});
			},
			updateStatus: function (url) {
				return jenkins(url).then(function (data) {
					return Jobs.add(url, data);
				});
			},
			updateAllStatus: function () {
				return initialize.then(function () {
					var promises = [];
					angular.forEach(Jobs.list, function (_, url) {
						promises.push(Jobs.updateStatus(url));
					});
					return promises;
				});
			}
		};

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
					lastBuild: data.lastCompletedBuild || {}
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
