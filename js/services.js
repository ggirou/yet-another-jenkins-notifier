/**
 * Yet Another Jenkins Notifier
 * Copyright (C) 2016 Guillaume Girou
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

var Services = (function () {
  'use strict';

  var _ = {
    forEach: function (obj, iterator) {
      if (obj) {
        if (obj.forEach) {
          obj.forEach(iterator);
        } else if ('length' in obj && obj.length > 0) {
          for (var i = 0; i < obj.length; i++) {
            iterator(obj[i], i);
          }
        } else {
          for (var key in obj) {
            if (obj.hasOwnProperty(key)) {
              iterator(obj[key], key);
            }
          }
        }
      }
      return obj;
    }
  };

  // Initialize options and listen for changes
  function initOptions($rootScope, Storage) {
    $rootScope.options = {
      refreshTime: 60,
      notification: 'all'
    };

    Storage.get({options: $rootScope.options}).then(function (objects) {
      $rootScope.options = objects.options;
      $rootScope.$broadcast('Options::options.changed', $rootScope.options);
    });

    Storage.onChanged.addListener(function (objects) {
      if (objects.options) {
        $rootScope.options = objects.options.newValue;
        $rootScope.$broadcast('Options::options.changed', $rootScope.options);
      }
    });
  }

  // Initialize jobs and listen for changes
  function initJobs(Jobs, Storage, $rootScope) {
    Jobs.jobs = {};

    Storage.get({jobs: Jobs.jobs}).then(function (objects) {
      Jobs.jobs = objects.jobs;
      $rootScope.$broadcast('Jobs::jobs.initialized', Jobs.jobs);
      $rootScope.$broadcast('Jobs::jobs.changed', Jobs.jobs);
    });

    Storage.onChanged.addListener(function (objects) {
      if (objects.jobs) {
        Jobs.jobs = objects.jobs.newValue;
        $rootScope.$broadcast('Jobs::jobs.changed', Jobs.jobs);
      }
    });
  }

  function defaultJobDataService() {
    return function (url, status) {
      var jobNameRegExp = /.*\/job\/([^/]+)(\/.*|$)/;
      return {
        name: decodeURI(url.replace(jobNameRegExp, '$1')),
        url: url,
        status: status,
        building: false,
        lastBuild: {}
      };
    }
  }

  function JobsService($q, Storage, jenkins, defaultJobData) {
    var Jobs = {
      jobs: {},
      add: function (url, data) {
        var result = {};
        result.oldValue = Jobs.jobs[url];
        result.newValue = Jobs.jobs[url] = data || Jobs.jobs[url] || defaultJobData(url);
        return Storage.set({jobs: Jobs.jobs}).then(function () {
          return result;
        });
      },
      remove: function (url) {
        delete Jobs.jobs[url];
        return Storage.set({jobs: Jobs.jobs});
      },
      updateStatus: function (url) {
        return jenkins(url).then(function (data) {
          return Jobs.add(url, data);
        });
      },
      updateAllStatus: function () {
        var promises = [];
        _.forEach(Jobs.jobs, function (_, url) {
          promises.push(Jobs.updateStatus(url));
        });
        return $q.when(promises);
      }
    };

    return Jobs;
  }

  function jenkinsService($http, defaultJobData) {
    var xmlParser = new DOMParser();
    var viewUrlRegExp = /^http:\/\/[^/]+\/(view\/[^/]+\/)?$/;
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

    function jobMapping(data) {
      var basicColor = (data.color || '').replace(buildingRegExp, '');
      var lastBuild = data.lastCompletedBuild || {};
      return {
        name: data.displayName || data.name,
        url: data.url,
        building: buildingRegExp.test(data.color),
        status: status[basicColor] || basicColor,
        statusClass: colorToClass[basicColor],
        lastBuildNumber: lastBuild.number || ''
      };
    }

    return function (url) {
      url = url.charAt(url.length - 1) === '/' ? url : url + '/';

      return $http.get(url + 'api/json/').then(function (res) {
        var data = res.data;
        if (viewUrlRegExp.test(url)) {
          var view = {
            isView: true,
            name: data.name || data.nodeName || 'All jobs',
            url: data.url || url,
            building: false,
            jobs: data.jobs.reduce(function (jobs, data) {
              var job = jobMapping(data);
              jobs[job.name] = job;
              return jobs;
            }, {})
          };

          return $http.get(url + 'cc.xml').then(function (res) {
            var projects = xmlParser.parseFromString(res.data, 'text/xml').getElementsByTagName('Project');
            _.forEach(projects, function (project) {
              var name = project.attributes['name'].value;
              var url = project.attributes['webUrl'].value;
              var lastBuildNumber = project.attributes['lastBuildLabel'].value;

              var job = view.jobs[name];
              if (job && !job.lastBuildNumber) {
                job.lastBuildNumber = lastBuildNumber;
                job.url = url;
              }
            });
            return view;
          });
        } else {
          return jobMapping(data);
        }
      }).catch(function (res) {
        return defaultJobData(url, res.status == 403 ? 'Forbidden' : 'Unreachable');
      });
    }
  }

  function buildWatcherService($rootScope, $interval, Jobs, buildNotifier) {
    function runUpdateAndNotify(options) {
      if (options.notification === 'none')
        return;

      return $interval(function (Jobs, buildNotifier) {
        Jobs.updateAllStatus().then(buildNotifier);
      }, options.refreshTime * 1000, 0, false, Jobs, buildNotifier);
    }

    return function () {
      var currentInterval = runUpdateAndNotify($rootScope.options);

      $rootScope.$on('Options::options.changed', function (_, options) {
        $interval.cancel(currentInterval);
        currentInterval = runUpdateAndNotify(options);
      });
    };
  }

  function buildNotifierService($rootScope, Notification) {
    function jobNotifier(newValue, oldValue) {
      oldValue = oldValue || {};
      if (oldValue.lastBuildNumber == newValue.lastBuildNumber)
        return;

      var title = 'Build ' + newValue.status + '!';
      if ($rootScope.options.notification === 'unstable' && newValue.status === 'Success' && newValue.lastBuildNumber > 1) {
        if (oldValue.status === 'Success') {
          return;
        } else {
          title = 'Build back to stable!';
        }
      }

      Notification.create(null, {
          type: 'basic',
          title: title + ' - ' + newValue.name,
          message: decodeURI(newValue.url + newValue.lastBuildNumber),
          iconUrl: 'img/logo.svg'
        },
        {
          onClicked: function () {
            window.open(newValue.url + newValue.lastBuildNumber);
          }
        }
      );
    }

    return function (promises) {
      promises.forEach(function (promise) {
        promise.then(function (data) {
          // Disable notification for pending promises
          if ($rootScope.options.notification === 'none')
            return;

          var oldValue = data.oldValue;
          var newValue = data.newValue;

          if (newValue.isView) {
            _.forEach(newValue.jobs, function (job, name) {
              jobNotifier(job, oldValue && oldValue.jobs && oldValue.jobs[name]);
            });
          } else {
            jobNotifier(newValue, oldValue);
          }
        });
      });
    };
  }

  function StorageService($q) {
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
  }

  function NotificationService($q) {
    var notifications = chrome.notifications;
    var Listeners = {};

    notifications.onClicked.addListener(function (notificationId) {
      var listener = Listeners[notificationId] || {};
      if (typeof listener.onClicked === 'function') {
        listener.onClicked();
      }
    });

    notifications.onClosed.addListener(function (notificationId) {
      var listener = Listeners[notificationId] || {};
      if (typeof listener.onClosed === 'function') {
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
  }

  if (typeof angular !== 'undefined') {
    angular.module('jenkins.notifier', [])
      .run(initOptions)
      .run(initJobs)
      .service('defaultJobData', defaultJobDataService)
      .service('Jobs', JobsService)
      .config(function ($httpProvider) {
        $httpProvider.useApplyAsync(true);
        $httpProvider.defaults.cache = false;
      })
      .service('jenkins', jenkinsService)
      .service('buildWatcher', buildWatcherService)
      .service('buildNotifier', buildNotifierService)
      .filter('decodeURI', function () {
        return decodeURI;
      })
      .service('Storage', StorageService)
      .service('Notification', NotificationService);
  }

  var $rootScope = {
    $broadcast: function (name, detail) {
      window.dispatchEvent(new CustomEvent(name, {detail: detail}));
    },
    $on: function (name, callback) {
      window.addEventListener(name, function (e) {
        callback(e, e.detail);
      });
    }
  };
  var $q = {
    defer: function () {
      var defer = {};
      defer.promise = new Promise(function (resolve, reject) {
        defer.resolve = resolve;
        defer.reject = reject;
      });
      return defer;
    },
    when: function (value) {
      return Promise.resolve(value);
    }
  };
  var $http = {
    get: function (url) {
      return fetch(url, {
        credentials: 'include'
      });
    }
  };
  var Storage = StorageService($q);
  var defaultJobData = defaultJobDataService();
  var jenkins = jenkinsService($http, defaultJobData);
  var Jobs = JobsService($q, Storage, jenkins, defaultJobData);
  var Notification = NotificationService($q);
  var buildNotifier = buildNotifierService($rootScope, Notification);

  initOptions($rootScope, Storage);
  initJobs(Jobs, Storage, $rootScope);

  return {
    _: _,
    $rootScope: $rootScope,
    $q: $q,
    Storage: Storage,
    Jobs: Jobs,
    Notification: Notification,
    buildNotifier: buildNotifier
  };
})();
