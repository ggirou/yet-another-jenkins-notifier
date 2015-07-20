angular.module('jenkins.notifier', [])
	.controller('JobListController', function ($scope, $window, Runtime, Jobs, buildNotifier) {
		$scope.jobs = Jobs.list;

		Jobs.updateAllStatus().then(buildNotifier);

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
		$scope.openOptionsPage = Runtime.openOptionsPage;

		$scope.decodeURI = decodeURI;
	})
	.service('Jobs', function ($rootScope, Storage, jenkins) {
		var jobNameRegExp = /.*\/job\/([^/]+)(\/.*|$)/;

		var initialize = Storage.get({jobs: {}});

		initialize.then(function (objects) {
			angular.copy(objects.jobs, Jobs.list);
		});

		Storage.onChanged.addListener(function (objects) {
			if (objects.jobs) {
				$rootScope.$apply(function () {
					angular.copy(objects.jobs.newValue, Jobs.list);
				});
			}
		});

		var Jobs = {
			list: {},
			add: function (url, data) {
				var result = {};
				return initialize.then(function () {
					result.oldValue = Jobs.list[url];
					result.newValue = Jobs.list[url] = data || Jobs.list[url] || {
							name: decodeURI(url.replace(jobNameRegExp, "$1")),
							url: url
						};
					return Storage.set({jobs: Jobs.list});
				}).then(function () {
					return result;
				});
			},
			remove: function (url) {
				return initialize.then(function () {
					delete Jobs.list[url];
					return Storage.set({jobs: Jobs.list});
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
		var buildingRegExp = /_anime$/;
		var colorToClass = {
			blue: 'success', yellow: 'warning', red: 'danger'
		};
		var status = {
			blue: 'Success', yellow: 'Unstable', red: 'Failure', aborted: 'Aborted', notbuilt: 'Not built', disabled: 'Disabled'
		};

		return function (url) {
			var url = url.charAt(url.length - 1) === '/' ? url : url + '/';
			return $http.get(url + 'api/json/').then(function (res) {
				var data = res.data;
				var basicColor = (data.color || "").replace(buildingRegExp, '');
				return {
					name: data.displayName || data.name,
					url: data.url,
					buildable: data.buildable,
					building: buildingRegExp.test(data.color),
					status: status[basicColor] || basicColor,
					statusClass: colorToClass[basicColor],
					lastBuild: data.lastCompletedBuild || {}
				};
			});
		}
	})
	.service('buildWatcher', function ($interval, Jobs, Storage, buildNotifier) {
		var defaultOptions = {options: {refreshTime: 60}};

		function runUpdateAndNotify(refreshTime) {
			return $interval(function () {
				console.log("Updating status...");
				Jobs.updateAllStatus().then(buildNotifier);
			}, refreshTime * 1000);
		}

		return function () {
			return Storage.get(defaultOptions).then(function (objects) {
				var currentInterval = runUpdateAndNotify(objects.options.refreshTime);

				Storage.onChanged.addListener(function (objects) {
					if (objects.options) {
						console.log("Refresh time changed:", objects.options.newValue.refreshTime);
						$interval.cancel(currentInterval);
						currentInterval = runUpdateAndNotify(objects.options.newValue.refreshTime);
					}
				});
			});
		};
	})
	.service('buildNotifier', function (Notification) {
		return function (promises) {
			promises.forEach(function (promise) {
				promise.then(function (data) {
					var oldValue = data.oldValue;
					var newValue = data.newValue;

					if (oldValue && oldValue.lastBuild && oldValue.lastBuild.number === newValue.lastBuild.number) {
						return;
					}

					Notification.create(null, {
							type: "basic",
							title: "Build " + newValue.status + "! - " + newValue.name,
							message: decodeURI(newValue.lastBuild.url),
							iconUrl: "img/logo.svg"
						},
						{
							onClicked: function () {
								window.open(newValue.lastBuild.url);
							}
						}
					);
				});
			});
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
	.service('Runtime', function ($window) {
		return {
			openOptionsPage: function () {
				var runtime = chrome.runtime;
				if (runtime.openOptionsPage) {
					// New way to open options pages, if supported (Chrome 42+).
					runtime.openOptionsPage();
				} else {
					// Reasonable fallback.
					$window.open(runtime.getURL('options.html'));
				}
			}
		};
	})
;
