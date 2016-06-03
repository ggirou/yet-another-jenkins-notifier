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

(function () {
  "use strict";

  angular.module('jenkins.notifier').run(function ($rootScope, $q, Jobs, buildWatcher) {
    $rootScope.$on('Jobs::jobs.initialized', function () {
      Jobs.updateAllStatus().then($q.all).then(buildWatcher);
    });
    $rootScope.$on('Jobs::jobs.changed', function (_, jobs) {
      var counts = {};
      angular.forEach(jobs, function (data) {
        if (data.isView) {
          angular.forEach(data.jobs, function (viewJob) {
            counts[viewJob.status] = (counts[viewJob.status] || 0) + 1;
          });
        } else {
          counts[data.status] = (counts[data.status] || 0) + 1;
        }
      });

      var count = counts.Failure || counts.Unstable || counts.Success || 0;
      var color = counts.Failure ? '#c9302c' : counts.Unstable ? '#f0ad4e' : '#5cb85c';
      chrome.browserAction.setBadgeText({text: count.toString()});
      chrome.browserAction.setBadgeBackgroundColor({color: color});
    });
  });

  angular.bootstrap(document, ['jenkins.notifier']);
})();
