angular.module('jenkins.notifier').run(function ($rootScope, $q, Jobs, buildWatcher) {
	$rootScope.$on('jobsInitialized', function () {
		Jobs.updateAllStatus().then($q.all).then(buildWatcher);
	});
});

angular.bootstrap(document, ['jenkins.notifier']);