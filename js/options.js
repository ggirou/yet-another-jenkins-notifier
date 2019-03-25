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

  Services.init();

  var Jobs = Services.Jobs;
  var $rootScope = Services.$rootScope;

  var urlsTextarea = document.querySelector('#urls');

  $rootScope.$on('Jobs::jobs.initialized', function (event, jobs) {
    showJobUrls(jobs);
  });

  NodeList.prototype.forEach = Array.prototype.forEach;

  var refreshTimeInput = document.getElementById('refreshTime');
  var refreshTimeSpan = document.getElementById('refreshTimeSpan');
  var optionsStatusElement = document.getElementById('optionStatus');
  var urlsStatusElement = document.getElementById('urlsStatus');

  var defaultOptions = {
    refreshTime: 60,
    notification: 'all',
    hiddenStatusList: [],
  };

  function showSavedNotification(statusElement) {
    // Update status to let user know options were saved.
    statusElement.style.visibility = "";
    setTimeout(function () {
      statusElement.style.visibility = "hidden";
    }, 2000);
  };

  function showJobUrls(jobs) {
    urlsTextarea.value = Object.keys(jobs).join("\n");
  };

  // Saves options to chrome.storage.local.
  function saveOptions() {
    var options = {
      refreshTime: refreshTimeInput.value,
      notification: document.querySelector("[name=notification]:checked").value,
      hiddenStatusList: []
    };
    if (!document.querySelector("[name=show_success]").checked){
        options.hiddenStatusList.push(document.querySelector("[name=show_success]").value);
    };
    if (!document.querySelector("[name=show_unstable]").checked){
        options.hiddenStatusList.push(document.querySelector("[name=show_unstable]").value);
    };
    if (!document.querySelector("[name=show_failure]").checked){
        options.hiddenStatusList.push(document.querySelector("[name=show_failure]").value);
    };
    if (!document.querySelector("[name=show_not_built]").checked){
        options.hiddenStatusList.push(document.querySelector("[name=show_not_built]").value);
    };
    if (!document.querySelector("[name=show_aborted]").checked){
        options.hiddenStatusList.push(document.querySelector("[name=show_aborted]").value);
    };
    if (!document.querySelector("[name=show_disabled]").checked){
        options.hiddenStatusList.push(document.querySelector("[name=show_disabled]").value);
    };

    chrome.storage.local.set({options: options}, function () {
      showSavedNotification(optionsStatusElement);
    });
  }

  // Saves urls to chrome.storage.local.
  function saveUrls() {
    var value = urlsTextarea.value.trim();
    var newUrls = value ? value.replace(/[\r\n]+/g, "\n").split("\n") : [];
    Jobs.setUrls(newUrls).then(showJobUrls).then(function () {
      showSavedNotification(urlsStatusElement);
    });
  }

  // Restores the preferences stored in chrome.storage.
  function restoreOptions() {
    // TODO create and use OptionService
    chrome.storage.local.get({options: defaultOptions}, function (objects) {
      var options = objects.options;
      document.querySelector('[name=notification]:checked').checked = false;
      document.querySelector('[name=notification][value="' + options.notification + '"]').checked = true;
      refreshTimeSpan.textContent = refreshTimeInput.value = options.refreshTime;

      document.querySelector("[name=show_success]").checked = false;
      if (options.hiddenStatusList.indexOf("Success") === -1){
        document.querySelector("[name=show_success]").checked = true;
      };

      document.querySelector("[name=show_unstable]").checked = false;
      if (options.hiddenStatusList.indexOf("Unstable") === -1){
        document.querySelector("[name=show_unstable]").checked = true;
      };

      document.querySelector("[name=show_failure]").checked = false;
      if (options.hiddenStatusList.indexOf("Failure") === -1){
        document.querySelector("[name=show_failure]").checked = true;
      };

      document.querySelector("[name=show_not_built]").checked = false;
      if (options.hiddenStatusList.indexOf("Not built") === -1){
        document.querySelector("[name=show_not_built]").checked = true;
      };

      document.querySelector("[name=show_aborted]").checked = false;
      if (options.hiddenStatusList.indexOf("Aborted") === -1){
        document.querySelector("[name=show_aborted]").checked = true;
      };

      document.querySelector("[name=show_disabled]").checked = false;
      if (options.hiddenStatusList.indexOf("Disabled") === -1){
        document.querySelector("[name=show_disabled]").checked = true;
      };
    });
  }

  function updateRefreshTimeSpan() {
    refreshTimeSpan.textContent = refreshTimeInput.value;
  }

  document.addEventListener('DOMContentLoaded', restoreOptions);
  document.querySelectorAll('input').forEach(function (element) {
    element.addEventListener('change', saveOptions);
  });
  document.querySelector('#saveUrls').addEventListener('click', saveUrls);
  refreshTimeInput.addEventListener('input', updateRefreshTimeSpan);
})();
