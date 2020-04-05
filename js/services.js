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
    },
    clone: function (obj) {
      return JSON.parse(JSON.stringify(obj));
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
        url: decodeURI(url),
        building: false,
        status: status || '',
        statusClass: undefined,
        statusIcon: undefined,
        lastBuildNumber: undefined,
        error: undefined,
        jobs: undefined
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
      setUrls: function (urls) {
        var newJobs = {};
        urls.forEach(function (url) {
          newJobs[url] = Jobs.jobs[url] || defaultJobData(url);
        });
        Jobs.jobs = newJobs;

        return Storage.set({jobs: Jobs.jobs}).then(function () {
          return Jobs.jobs;
        });
      },
      updateStatus: function (url) {
        return jenkins(url).catch(function (res) {
          // On error, keep existing data or create default one
          var data = _.clone(Jobs.jobs[url]) || defaultJobData(url);
          data.error = (res instanceof Error ? res.message : res.statusText) || 'Unreachable';
          return data;
        }).then(function (data) {
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

  function jenkinsService(defaultJobData) {
    var xmlParser = new DOMParser();
    var buildingRegExp = /_anime$/;
    var colorToClass = {
      blue: 'success', yellow: 'warning', red: 'danger'
    };
    var colorToIcon = {
      blue: 'green', yellow: 'yellow', red: 'red'
    };
    var status = {
      blue: 'Success',
      yellow: 'Unstable',
      red: 'Failure',
      aborted: 'Aborted',
      notbuilt: 'Not built',
      disabled: 'Disabled'
    };
    var fetchOptions = {
      credentials: 'include'
    };

    function jobMapping(url, data) {
      var basicColor = (data.color || '').replace(buildingRegExp, '');
      var lastBuild = data.lastCompletedBuild || {};
      return {
        name: data.displayName || data.name || data.nodeName || 'All jobs',
        url: decodeURI(data.url || url),
        building: buildingRegExp.test(data.color),
        status: status[basicColor] || basicColor,
        statusClass: colorToClass[basicColor] || '',
        statusIcon: colorToIcon[basicColor] || 'grey',
        lastBuildNumber: lastBuild.number || '',
        lastBuildTime: '',
        jobs: data.jobs && data.jobs.reduce(function (jobs, data) {
          var job = jobMapping(data.url, data);
          jobs[subJobKey(job.url)] = job;
          return jobs;
        }, {})
      };
    }

    function subJobKey(url) {
      return url.replace(/^.+?\/job\/(.+)\/$/, "$1").replace(/\/job\//g, "/");
    }

    return function (url) {
      url = url.charAt(url.length - 1) === '/' ? url : url + '/';

      let basicList = 'displayName,name,nodeName,url,color,lastCompletedBuild[number]';
      let deepList = basicList;
      for (let depth = 3; depth > 0; depth--) {
        deepList = basicList + ',jobs[' + deepList + ']';
      }
      return fetch(url + 'api/json?tree=' + encodeURIComponent(deepList), fetchOptions).then(function (res) {
        return res.ok ? res.json() : Promise.reject(res);
      }).then(function (data) {
        var job = jobMapping(url, data);

        if (false && data.jobs) {
          return fetch(url + 'cc.xml', fetchOptions).then(function (res) {
            return res.ok ? res.text() : Promise.reject(res);
          }).then(function (text) {
            var projects = xmlParser.parseFromString(text, 'text/xml').getElementsByTagName('Project');

            _.forEach(projects, function (project) {
              var url = decodeURI(project.attributes['webUrl'].value);
              var name = subJobKey(url);
              var lastBuildNumber = project.attributes['lastBuildLabel'].value;
              var lastBuildTime = new Date(project.attributes['lastBuildTime'].value).toISOString();

              var subJob = job.jobs[name];
              if (subJob && !subJob.lastBuildNumber) {
                subJob.name = name;
                subJob.lastBuildNumber = lastBuildNumber;
                subJob.lastBuildTime = lastBuildTime;
              }
            });

            return job;
          });
        } else {
          return job;
        }
      });
    }
  }

  function buildWatcherService($rootScope, Jobs, buildNotifier) {
    function runUpdateAndNotify(options) {
      if (options.notification === 'none')
        return;

      return window.setInterval(function (Jobs, buildNotifier) {
        Jobs.updateAllStatus().then(buildNotifier);
      }, options.refreshTime * 1000, Jobs, buildNotifier);
    }

    return function () {
      var currentInterval = runUpdateAndNotify($rootScope.options);

      $rootScope.$on('Options::options.changed', function (_, options) {
        window.clearInterval(currentInterval);
        currentInterval = runUpdateAndNotify(options);
      });
    };
  }

  function buildNotifierService($rootScope, Notification) {
    function jobNotifier(newValue, oldValue) {
      oldValue = oldValue || {};
      if (oldValue.lastBuildNumber == newValue.lastBuildNumber)
        return;

      // Ignore new job, not built yet
      if (newValue.status === 'Not built') {
        return;
      }

      var title = 'Build ' + newValue.status + '!';
      if ($rootScope.options.notification === 'unstable' && newValue.status === 'Success' && newValue.lastBuildNumber > 1) {
        if (oldValue.status === 'Success') {
          return;
        } else {
          title = 'Build back to stable!';
        }
      }

      var buildUrl = newValue.url + newValue.lastBuildNumber;
      Notification.create(null, {
          type: 'basic',
          title: title + ' - ' + newValue.name,
          message: buildUrl,
          iconUrl: 'img/logo-' + newValue.statusIcon + '.svg'
        },
        {
          onClicked: function () {
            chrome.tabs.create({'url': buildUrl});
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

          if (newValue.jobs) {
            _.forEach(newValue.jobs, function (job, url) {
              jobNotifier(job, oldValue && oldValue.jobs && oldValue.jobs[url]);
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
    },
    all: function (iterable) {
      return Promise.all(iterable);
    }
  };
  var Storage = StorageService($q);
  var defaultJobData = defaultJobDataService();
  var jenkins = jenkinsService(defaultJobData);
  var Jobs = JobsService($q, Storage, jenkins, defaultJobData);
  var Notification = NotificationService($q);
  var buildNotifier = buildNotifierService($rootScope, Notification);
  var buildWatcher = buildWatcherService($rootScope, Jobs, buildNotifier);

  return {
    _: _,
    $rootScope: $rootScope,
    $q: $q,
    Storage: Storage,
    Jobs: Jobs,
    Notification: Notification,
    buildNotifier: buildNotifier,
    buildWatcher: buildWatcher,
    init: function () {
      initOptions($rootScope, Storage);
      initJobs(Jobs, Storage, $rootScope);
    }
  };
})();
