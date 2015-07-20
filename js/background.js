angular.module('jenkins.notifier').run(function ($q, Jobs, Notification) {
	Jobs.updateAllStatus().then(function (promises) {
		return $q.all(promises);
	}).then(function () {
		window.setInterval(function () {
			Jobs.updateAllStatus().then(function (promises) {
				promises.forEach(function (promise) {
					promise.then(function (data) {
						var oldValue = data.oldValue;
						var newValue = data.newValue;

						if (oldValue && oldValue.lastBuild && oldValue.lastBuild.number === newValue.lastBuild.number) {
							return;
						}

						Notification.create(null, {
								type: "basic",
								title: "Build " + newValue.status + "! - " + newValue.name,
								message: decodeURI(newValue.lastBuild.url),
								iconUrl: "img/logo.svg"
							},
							{
								onClicked: function () {
									window.open(newValue.lastBuild.url);
								}
							}
						);
					});
				});
			});
		}, 5000);
	});
});

angular.bootstrap(document, ['jenkins.notifier']);