angular.module('jenkins.notifier').run(function (Jobs) {
	window.setInterval(function () {
		Jobs.list().then(function(urls) {
			console.log(urls);
		});
	}, 1000);
});

angular.bootstrap(document, ['jenkins.notifier']);