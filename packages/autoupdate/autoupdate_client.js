// Subscribe to the `meteor_autoupdate_clientVersions` collection,
// which contains the set of acceptable client versions.
//
// A "hard code push" occurs when the running client version is not in
// the set of acceptable client versions (or the server updates the
// collection, there is a published client version marked `current` and
// the running client version is no longer in the set).
//
// When the `reload` package is loaded, a hard code push causes
// the browser to reload, so that it will load the latest client
// version from the server.
//
// A "soft code push" represents the situation when the running client
// version is in the set of acceptable versions, but there is a newer
// version available on the server.
//
// `Autoupdate.newClientAvailable` is a reactive data source which
// becomes `true` if there is a new version of the client is available on
// the server.
//
// This package doesn't implement a soft code reload process itself,
// but `newClientAvailable` could be used for example to display a
// "click to reload" link to the user.

// The client version of the client code currently running in the
// browser.
var autoupdateVersion = __meteor_runtime_config__.autoupdateVersion || "unknown";


// The collection of acceptable client versions.
var ClientVersions = new Meteor.Collection("meteor_autoupdate_clientVersions");


Autoupdate = {};

Autoupdate.newClientAvailable = function () {
  return !! ClientVersions.findOne(
    {$and: [
      {current: true},
      {_id: {$ne: autoupdateVersion}}
    ]}
  );
};



// XXX This is a hack. See packages/livedata/livedata_common.js
var retry = new DDP._Retry();
// Unlike the stream reconnect use of Retry, which we want to be instant
// in normal operation, this is a wacky failure. We don't want to retry
// right away, we can start slowly.
var failures = 3; // start at about 30 seconds.

Autoupdate._retrySubscription = function () {
  Meteor.subscribe("meteor_autoupdate_clientVersions", {
    onError: function (error) {
      Meteor._debug("autoupdate subscription failed:", error);
      failures++;
      retry.retryLater(failures, function () {
        Autoupdate._retrySubscription();
      });
    },
    onReady: function () {
      if (Package.reload) {
        Deps.autorun(function (computation) {
          if (ClientVersions.findOne({current: true}) &&
              (! ClientVersions.findOne({_id: autoupdateVersion}))) {
            computation.stop();
            Package.reload.Reload._reload();
          }
        });
      }
  }
  });
};
Autoupdate._retrySubscription();
