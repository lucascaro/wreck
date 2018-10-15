# W.R.E.C.K. Web Reliable and Efficient Crawling Kit

## Design Principles

## Reliable

Data loss should be prevented at all costs. At any point, the program should be able to be aborted and allow for clean restarts, even in the case of unexpected failures.

The program should be able to continue working seamlessly from a previously aborted run without losing any of the work that was previously completed.

Additionally, if a URL can't be crawled or an unexpected error arises when crawling a given URL, the program should be able to note this error and continue working without crashing. That is, the program should try to recover from any errors if possible.

## Fast

To achieve maximum speed, the program will maximize concurrency when processing URLs. All I/O should be non-blocking and streams should be used when applicable. The program should automatically make use of all available resources, using forks to take advantage of all available CPU power.

For efficiency, the program will minimize the number of requests made as well as the bandwidth usage. If a resource does not need to be fully transfered, the program should not transfer it in full. Additionally, the program should avoid duplicated requests to the same URL.

## Flexible

The program will consist of a small core of basic functionality and a set of plugins.
This allows for robustness on the core feature set, and provides extensibility for new features or customizations.

Communication with the plugin as a cli should be via stdin / stdout so the program is composable.
Eventually, the program might expose a RESTful API to allow distributed processing of a big number of URLs.

## Easy to Use

User experience > Flexibility > Developer Experience > Ease of Implementation.

- The program should have sensible defaults and provide value with minimal arguments. Keep it simple for most users.
- The program should provide flexibility for power users, but never at the sacrifice of regular user experience.
- The program should make it easy for developer to write plugins while not sacrificing user experience.

## Core Features

- plugin support
- resume work if interrupted
- save bandwidth by doing HEAD requests when it makes sense.
- can start with a single URL in argument
- can start with a list of URLs in stdin
- processes each file only once
- simple default reporting
- configurable concurrency
- ad-hoc REST api? normal fork? pros / cons?
- local clustering?
  - Master would add initial urls to queue and spin up workers.
  - Master reads from queue and passes each url as an internal REST request to the workers.
  - workers claim the page from the queue, download it, parse it, add neighbours to queue, validate responses, etc.

## Plugins

- caching

  - can cache url responses to use between crawls
  - can disable or clear cache
  - can set pattern to exclude from cache
  - remote caching (s3, redis?)

- filtering

  - multiple include patters
  - multiple exclude patters

- retrying
  - auto retry with other protocols
  - retry specific urls
  - retry failed urls
  - retry subset

- report

  - different output formats
  - different report types

- clustering
  - distribute crawls to different servers
  - coordinate execution in a fail-safe way -- shared remote work queue
  - multiple work queue back-end plugins?

## Architecture

### Main process

The main process is in charge of:

- reading input
- loading plugins
- setting up a work queue
- starting worker processes
- displaying output

Essentially, the program uses a mediator architecture, and the main process is the mediator. The work queue and workers are modules. Other plugins are also modules subscribing and emiting events.

The total number of work processes can be configured, and will default to the number of CPUs. This number is choosen since the processing needs of the work queue and main process are relatively low while the workers are executing, and to maximize usage of available resources.

The usual caveats for concurrent programs apply, and all processes should be coded defensively.

Initially, all work happens locally in forked processes. Eventually work can be distributed by starting a crawler that connects to a remote work queue instead of starting a new local one.

Might be worth exploring optionally starting the program in "master mode", "work queue" mode or "worker mode" to allow for a cluster of crawlers to work together.

If started in master mode, the program will parse the input, push to a work queue, and wait for the queue to be finished.

If started in work queue mode, the program will spin up a work queue server.

If the program is started in worker mode, it will spawn worker processes that pull from a specified queue.

### Work queue

The work queue consists of work configuration (which plugins and options are enabled), a list of URLs to be crawled, and a list of already crawled URLs, plus their result.

Initially, the work queue can be in-memory, eventually it can be extracted to a fast remote database like redis.

The work queue might optionally expose an API to abstract and interact with the queue (useful for distributed runs).

Caveats:

To ensure reliability and the ability to resume work, urls can't be removed from the work queue until a worker has finished processing.

For performance issues, we don't want more than one worker to ever process the same url at the same time.

To solve for this, workers need to _claim_ a url from the queue before processing it.
In case the worker dies without reporting back results for the queue, and in order to not have urls stuck at the _claim_ state, the work queue will automatically:

- Remove any claims made by a worker that it's known to be dead.
- Timeout any claims made by a worker if the results are not back after a predefined time.
- On claim, inform the worker of the maximum time allowed to process the URL.

### Worker processes

Worker processes take URLs from the work queue, process the responses, and report the results back to the work queue.

For each URL they will fetch it either via GET or HEAD (must make sure HEAD failures are not due to the server not supporting HEAD requests).

Event driven mediator pattern:

Main process acting as mediator, can post and receive events from / to other processes and plugins.

Ex:
Main emmits create new work queue

- work queue process receives that and creates a new queue
- some other plugin hears that and does something

Main receives "work item done"

- Main reads the results and decides to emit "work item done" to all plugins
- Plugin B listens for this even and tracks stats for results
