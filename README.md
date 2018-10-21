# W.R.E.C.K. Web Crawler

WRECK is a fast, reliable, flexible web crawling kit.

## Project Status

This project is in the [design](./DESIGN.md) and prototype phase.

## Roadmap

- [x] Initial design and request for feedback
- [x] First prototype for testing
  - [x] Multi process crawling
  - [x] Configurable per-process concurrency
  - [x] HTTP and HTTPS support
  - [x] HTTP retries
  - [x] HEAD and GET requests
  - [x] Shared work queue
  - [x] Request rate limiting
  - [x] Crawl depth
  - [x] Limit to original domain
  - [x] URL normalization
  - [x] Exclude patterns
  - [x] Persistent state across runs
  - [x] Maximum request limit
  - [x] Output levels
  - [x] Simple reporting
  - [x] Basic unit testing
  - [ ] Nofollow patters
  - [ ] Include patterns
- [ ] Domain whitelist
- [ ] Reporting
- [ ] Unit testing
- [ ] Functional testing
- [ ] Incorporate design feedback
- [ ] Code clean-up
- [ ] Performance and memmory profiling and improvements
- [ ] Implement all core features
- [ ] Add to npm registry

## Installing

  ```bash
  git clone git@github.com:lucascaro/wreck.git
  cd wreck
  npm link
  ```

## Running

### Show available commands

```bash
$ wreck

wreck v0.0.1

Usage:
 wreck               [options] [commands]   Reliable and Efficient Web Crawler

Options:
    -v --verbose                  Make operation more talkative.
    -s --silent                   Make operation silent (Only errors and warnings will be shown).
    -f --state-file    <fileName> Path to status file.

Available Subcommands:
   crawl

   report


 run wreck  help <subcommand> for more help.

```

### Crawl

```bash
$ wreck help crawl

crawl

Usage:
 crawl               [options]

Options:
    -u --url           <URL>      Crawl starting from this URL
    -R --retries       <number>   Maximum retries for a URL
    -t --timeout       <number>   Maximum seconds to wait for requests
    -m --max-requests  <number>   Maximum request for this run.
    -n --no-resume                Force the command to restart crawling from scratch, even if there is saved state.
    -w --workers       <nWorkers> Start this many workers. Defaults to one per CPU.
    -d --max-depth     <number>   Maximum link depth to crawl.
    -r --rate-limit    <number>   Number of requests that will be made per second.
    -e --exclude       <regex>    Do now crawl URLs that match this regex. Can be specified multiple times.
    -c --concurrency   <concurrency> How many requests can be active at the same time.
```

### Crawl an entire website

Default operation:

```bash
wreck crawl -u https://example.com
```

This will use the default operation mode:

- 1 worker process per CPU
- 100 maximum concurrent requests
- save state to ./wreck.run.state.json
- automatically resume work if state file is present
- unlimited crawl depth
- limit crawling to the provided main domain
- no rate limit
- 3 maximum retries for urls that return a 429 status code

Minimal operation (useful for debugging):

```bash
wreck crawl -u https://example.com --concurrency=1 --workers=1 --rate-limit=1
```

### Debug

This project uses [debug](https://www.npmjs.com/package/debug). Set the environment variable `DEBUG` to `*` to see all output:

```bash
DEBUG=* wreck crawl -u https://example.com
```

## Contributing

Please feel free to add questions, comments, and suggestions via github issues.
