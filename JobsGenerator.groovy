// To be run with Job DSL Plugin
// https://wiki.jenkins-ci.org/display/JENKINS/Job+DSL+Plugin
// https://jenkinsci.github.io/job-dsl-plugin/

def myJobs = [
  'My Aborted Job'              : jobDefinition(result: 'ABORTED'),
  'My Building Job'             : jobDefinition(result: 'UNSTABLE', queueJob: false, build: "sh 'sleep 300'"),
  'My Failing Job'              : jobDefinition(result: 'FAILURE'),
  'My New Job'                  : jobDefinition(result: 'ABORTED', queueJob: false),
  'My Stable Job'               : jobDefinition(result: 'SUCCESS'),
  'My Unstable Job'             : jobDefinition(result: 'UNSTABLE'),
  'yet-another-jenkins-notifier': yajnJob()
]

def myFolderName = 'My Folder'

def jobDefinition(Map args) {
  { name ->
    pipelineJob(name) {
      definition {
        cps {
          script("""
            node {
              stage 'Build'
              ${args.build ?: "echo 'Building'"}

              stage 'Result'
              currentBuild.result = '${args.result}'
            }""")
          sandbox()
        }
      }
    }

    if (args.queueJob != false) {
      println "Add job $name to queue"
      queue(name)
    }
  }
}

def yajnJob() {
  {
    name ->
      multibranchPipelineJob(name) {
        branchSources {
          git {
            remote('https://github.com/ggirou/yet-another-jenkins-notifier.git')
          }
        }
      }

      queue(name)
  }
}

// Now create myJobs and views

folder(myFolderName) {
  displayName(myFolderName)
}

myJobs.each { name, jobDefinition ->
  jobDefinition(name)
  jobDefinition("$myFolderName/$name")
}

listView("$myFolderName/All branches") {
  description('All branches myJobs from sub-folders')
  recurse()
  jobs {
    regex('.+/.+')
  }
  columns {
    status()
    weather()
    name()
    lastSuccess()
    lastFailure()
    lastDuration()
    buildButton()
  }
}
