angular.module('jenkins.notifier').run(function ($rootScope, $q, Jobs, buildWatcher) {
	$rootScope.$on('jobsInitialized', function () {
		Jobs.updateAllStatus().then($q.all).then(buildWatcher);
	});
	$rootScope.$watch('jobs', function (jobs) {
		var counts = {};
		angular.forEach(jobs, function (data) {
			counts[data.status] = (counts[data.status] || 0) + 1;
		});

		var count = counts.Failure || counts.Unstable || counts.Success || 0;
		var color = counts.Failure ? '#c9302c' : counts.Unstable ? '#f0ad4e' : '#5cb85c';
		chrome.browserAction.setBadgeText({text: count.toString()});
		chrome.browserAction.setBadgeBackgroundColor({color: color});
	});
});

angular.bootstrap(document, ['jenkins.notifier']);