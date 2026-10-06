# 1. Read no clock, and keep dates out of the repository

## Status

Accepted

## Context

A governance check tempts a tool to look at the calendar: how old a capability level is, which release of Fabric was the
newest on a day, how long a policy has been in place, when a certificate expires. Each of these would make the same file
give a different result on a different day, so a pipeline that passed yesterday could fail today with no change to the
repository, and two people reading the same commit could see two reports. The output could never be saved and compared.

The checks do not need a date. Whether a policy says ANY, how many consenters are listed, whether a certificate path is
written and which capability is on can all be read from the file as it is. The public pages the checks rest on are named
by addresses that hold no year: the Hyperledger Fabric documentation at its latest version and the sample file of the
main branch.

## Decision

1. The tool reads no clock, no time zone and no locale. It never prints the current time and never says when a page, a
   release or a certificate was published. The same file gives the same output on every machine and on every day.
2. No document, example or test of this repository holds a date or a number that reads like a year: not the licence, not
   the changelog, not the documents, not the comments of the code, not the examples. `npm run check` and a test fail on
   any word of four digits that starts with 19 or 20. The saved copies of the public pages under research/sources are
   the pages' own words and are the one place the check does not read for prose.
3. A version is not a year and is not caught: 1.0.0, V2_0, 3F+1 and a port such as 7050 hold no word of four digits that
   starts with 19 or 20. A test of test/repo.test.js runs the pattern over such values and checks that none of them is
   caught, and that a year in the same place still is.
4. The sources are chosen with addresses that hold no year, and the notes on them name no publication date.

## Consequences

- The output of a run can be saved in the repository (`examples/output`) and compared on every change, because it does
  not move with the calendar.
- The report holds no date and no deadline; a team puts dates in its own plan.
- The examples use ports and names that do not read like a year, and a check catches one that does.
