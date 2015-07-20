angular.module('jenkins.notifier').run(function ($q, Jobs, buildWatcher) {
	Jobs.updateAllStatus().then(function (promises) {
		return $q.all(promises);
	}).then(function () {
		buildWatcher();
	});
});

angular.bootstrap(document, ['jenkins.notifier']);