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
  'use strict';

  function documentReady() {
    Services.init();

    var _ = Services._;
    var Jobs = Services.Jobs;

    var $rootScope = Services.$rootScope;
    $rootScope.$on('Jobs::jobs.initialized', function () {
      Jobs.updateAllStatus().then(Services.buildNotifier);
    });
    $rootScope.$on('Jobs::jobs.changed', function (_, jobs) {
      renderJobs(jobs);
    });

    var optionsLink = document.getElementById('optionsLink');
    var urlForm = document.getElementById('urlForm');
    var urlInput = document.getElementById('url');
    var addButton = document.getElementById('addButton');
    var errorMessage = document.getElementById('errorMessage');

    optionsLink.addEventListener('click', openOptionsPage);
    urlForm.addEventListener('submit', addUrl);
    urlForm.addEventListener('input', validateForm);

    validateForm();
    placeholderRotate();

    function openOptionsPage() {
      if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage(); // Chrome 42+, Firefox 48
      } else {
        chrome.tabs.create({'url': chrome.runtime.getURL('options.html')});
      }
    }

    function addUrl(event) {
      event.preventDefault();

      var url = urlInput.value;
      Jobs.add(url).then(function () {
        urlInput.value = '';
      }).then(function () {
        return Jobs.updateStatus(url);
      });
    }

    function validateForm() {
      var isFormInvalid = !urlForm.checkValidity();
      var isUrlInvalid = !urlInput.validity.typeMismatch;

      addButton.disabled = isFormInvalid;
      urlForm.classList.toggle('has-error', isFormInvalid && urlInput.value);
      errorMessage.classList.toggle('hidden', isUrlInvalid);
      errorMessage.innerText = urlInput.validationMessage;
    }

    function placeholderRotate() {
      var placeholderUrls = [
        'http://jenkins/ for all jobs',
        'http://jenkins/job/my_job/ for one job',
        'http://jenkins/job/my_view/ for view jobs'
      ];

      var i = 0;
      urlInput.placeholder = placeholderUrls[0];
      window.setInterval(function () {
        urlInput.placeholder = placeholderUrls[++i % placeholderUrls.length];
      }, 5000);
    }

    var jobList = document.getElementById('jobList');
    var jobItemTemplate = document.getElementById('jobItemTemplate');
    var jobSubItemTemplate = document.getElementById('jobSubItemTemplate');

    function removeUrlClick(event) {
      Jobs.remove(event.currentTarget.dataset.url);
    }

    function renderJobs(jobs) {
      renderRepeat(jobList, jobItemTemplate, jobs, renderJobOrView);
    }

    function renderJobOrView(node, url, job) {
      renderJob(node, url, job);

      var closeButton = node.querySelector('button.close');
      closeButton.dataset.url = url;
      closeButton.addEventListener('click', removeUrlClick);

      var subJobs = node.querySelector('[data-id="jobs"]');
      subJobs.classList.toggle('hidden', !job.jobs);
      renderRepeat(subJobs, jobSubItemTemplate, job.jobs, renderJob);
    }

    function renderJob(node, url, job) {
      node.classList.toggle('building', job.building);

      _.forEach(node.querySelectorAll('[data-jobfield]'), function (el) {
        el.innerText = job[el.dataset.jobfield];
      });

      _.forEach(node.querySelectorAll('[data-jobstatusclass]'), function (el) {
        el.className = el.className.replace(/ alert-.*$/, '').replace(/ ?$/, ' alert-' + job.statusClass);
      });

      _.forEach(node.querySelectorAll('[data-joberror]'), function (el) {
        el.classList.toggle('hidden', !job.error);
        el.setAttribute('title', 'Error: ' + job.error);
      });

      _.forEach(node.querySelectorAll('a[data-joburl]'), function (el) {
        el.href = job.url;
      });
    }

    function renderRepeat(container, template, obj, render) {
      var keys = Object.keys(obj || {});
      for (var i = 0; i < keys.length; i++) {
        container.appendChild(container.children[i] || document.importNode(template.content, true));
        render(container.children[i], keys[i], obj[keys[i]]);
      }
      for (var j = container.childElementCount - 1; j >= keys.length; j--) {
        container.children[j].remove();
      }
    }
  }

  document.addEventListener('DOMContentLoaded', documentReady);
})();
