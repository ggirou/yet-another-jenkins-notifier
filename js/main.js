/**
 * Yet Another Jenkins Notifier
 * Copyright (C) 2015 Guillaume Girou
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
angular.module('jenkins.notifier', [])
	.controller('JobListController', function ($scope, $window, Runtime, Jobs, buildNotifier, Notification) {

		Notification.create(null, {
				type: "basic",
				title: "Toto",
				message: "Message",
				iconUrl: "img/logo-failure.svg"
			}
		);

		$scope.$on('jobsInitialized', function () {
			Jobs.updateAllStatus().then(buildNotifier);
		});

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
	})
	// Initialize options
	.run(function ($rootScope, Storage) {
		$rootScope.options = {
			refreshTime: 60,
			notification: 'all'
		};

		Storage.get({options: $rootScope.options}).then(function (objects) {
			$rootScope.options = objects.options;
		});

		Storage.onChanged.addListener(function (objects) {
			if (objects.options) {
				$rootScope.$apply(function () {
					$rootScope.options = objects.options.newValue;
				});
			}
		});
	})
	// Initialize jobs
	.run(function ($rootScope, Storage) {
		$rootScope.jobs = {};

		Storage.get({jobs: $rootScope.jobs}).then(function (objects) {
			$rootScope.jobs = objects.jobs;
			$rootScope.$broadcast('jobsInitialized', $rootScope.jobs);
		});

		Storage.onChanged.addListener(function (objects) {
			if (objects.jobs) {
				$rootScope.$apply(function () {
					$rootScope.jobs = objects.jobs.newValue;
				});
			}
		});
	})
	.service('Jobs', function ($rootScope, $q, Storage, jenkins) {
		var jobNameRegExp = /.*\/job\/([^/]+)(\/.*|$)/;

		var Jobs = {
			add: function (url, data) {
				var result = {};
				result.oldValue = $rootScope.jobs[url];
				result.newValue = $rootScope.jobs[url] = data || $rootScope.jobs[url] || {
						name: decodeURI(url.replace(jobNameRegExp, "$1")),
						url: url
					};
				return Storage.set({jobs: $rootScope.jobs}).then(function () {
					return result;
				});
			},
			remove: function (url) {
				delete $rootScope.jobs[url];
				return Storage.set({jobs: $rootScope.jobs});
			},
			updateStatus: function (url) {
				return jenkins(url).then(function (data) {
					return Jobs.add(url, data);
				});
			},
			updateAllStatus: function () {
				var promises = [];
				angular.forEach($rootScope.jobs, function (_, url) {
					promises.push(Jobs.updateStatus(url));
				});
				return $q.when(promises);
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
			blue: 'Success',
			yellow: 'Unstable',
			red: 'Failure',
			aborted: 'Aborted',
			notbuilt: 'Not built',
			disabled: 'Disabled'
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
	.service('buildWatcher', function ($rootScope, $interval, Jobs, buildNotifier) {
		function runUpdateAndNotify(options) {
			if (options.notification === 'none')
				return;

			return $interval(function () {
				console.log("Updating status...");
				Jobs.updateAllStatus().then(buildNotifier);
			}, options.refreshTime * 1000);
		}

		return function () {
			var currentInterval = runUpdateAndNotify($rootScope.options);

			$rootScope.$watch('options', function (options) {
				console.log("Options changed:", options);
				$interval.cancel(currentInterval);
				currentInterval = runUpdateAndNotify(options);
			});
		};
	})
	.service('buildNotifier', function ($rootScope, Notification) {
		return function (promises) {
			promises.forEach(function (promise) {
				promise.then(function (data) {
					var oldValue = data.oldValue || {};
					var newValue = data.newValue;

					if ($rootScope.options.notification === 'none'
						|| (oldValue.lastBuild && oldValue.lastBuild.number === newValue.lastBuild.number))
						return;

					var title = "Build " + newValue.status + "!";
					if ($rootScope.options.notification === 'unstable' && newValue.status === 'Success') {
						if (oldValue.status === 'Success') {
							return;
						} else {
							title = "Build back to stable!";
						}
					}

					Notification.create(null, {
							type: "basic",
							title: title + " - " + newValue.name,
							message: decodeURI(newValue.lastBuild.url),
							iconUrl: "img/logo.svg?background-color=red"
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
	.filter('decodeURI', function () {
		return decodeURI;
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
