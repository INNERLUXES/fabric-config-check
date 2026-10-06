# Sources

The public pages the checks of this tool are based on, each with a short note in this project's own words on what the
page says and which checks lean on it. Nothing here is a copy of a page: read the page itself for its exact wording. A
plain text copy of each page, taken when it was read, is kept in [research/sources](sources) so that a point can be
checked against the page it came from, and the copies are the pages' own words, not this project's. src/data.js holds
the pages and the points the reports show, and test/data.test.js checks that every page in src/data.js is listed here and
has its copy.

The tool reads the configtx.yaml of a Hyperledger Fabric network as text and runs nothing; its result is an input to a
governance review before members join a network, not a security audit and not a guarantee that the network is safe.
These notes say what the pages say so a reader can follow a finding back to its source; they are not advice on any one
network. The pages were chosen with web addresses that hold no number that reads like a year: the Hyperledger Fabric
documentation at its latest version, and the sample file of the main branch of the Fabric repository.

Where a check rests on a statement the pages do not make, it is a best practice of this tool, its message says so, and
the note for the check in [docs/rules-and-sources.md](../docs/rules-and-sources.md) names the choice.

## The Hyperledger Fabric documentation

### Policies

https://hyperledger-fabric.readthedocs.io/en/latest/policies/policies.html

Copy: research/sources/policies.txt

The concept page for policies. Policies say how members agree to accept or reject changes to a network, a channel or a
smart contract. They default to a majority of the admins of the group they sit in, though any rule may be written.
Signature policies name the identities that must sign (with AND, OR and NOutOf), and ImplicitMeta policies aggregate
the sub-policies below them with ANY, ALL or MAJORITY. A modification policy says who must sign an update to the
element that carries it. The page shows the default Application policies of the test network (Readers and Writers ANY,
Admins MAJORITY, Endorsement and LifecycleEndorsement MAJORITY Endorsement), says the lifecycle policy governs who must
approve a chaincode definition, and says the defaults are for getting started and are meant to be customized in a
production network. `admins-any` and `endorsement-any` lean on it.

### Channel policies

https://hyperledger-fabric.readthedocs.io/en/latest/create_channel/channel_policies.html

Copy: research/sources/channel-policies.txt

How the default policies work together. A channel is a private way for organizations to communicate, so most changes
need the agreement of others. Each organization defines signature policies, and ImplicitMeta policies in the
Application, Orderer and Channel sections evaluate them. Each part of the configuration has a modification policy; with
the defaults, a majority of organizations must approve adding or removing a channel member, and a majority of orderer
organizations must approve adding or removing an ordering node. The page lists the default ImplicitMeta rules, so
Readers and Writers are ANY and Admins and Endorsement are MAJORITY. `single-organization`, `admins-any`,
`readers-writers-any` and `endorsement-any` lean on it.

### Using configtx.yaml to build a channel configuration

https://hyperledger-fabric.readthedocs.io/en/latest/create_channel/create_channel_config.html

Copy: research/sources/create-channel-config.txt

Walks through the sections of the file. Each organization has a Name, an ID (its MSP ID, the unique identifier policies
and transactions refer to) and an MSPDir (the folder the channel MSP is built from). There are three capability groups,
Application, Orderer and Channel, which set the lowest version of the binaries that may take part; the test network sets
all three to V2_0. Each consenter is identified by its endpoint and its client and server TLS certificates. BatchTimeout
and BatchSize, with MaxMessageCount, AbsoluteMaxBytes and PreferredMaxBytes, set how large a block is and how often one
is cut. The test network runs a single ordering node because it is for development, and a production network should
use a multi-node ordering service. Profiles gather their data from the other sections. `org-msp-incomplete`,
`duplicate-msp-id`, `consenter-tls-missing`, `batch-settings-missing`, `orderer-solo`, `raft-consenter-count`,
`capabilities-missing`, `capability-disabled` and `no-profiles` lean on it.

### Configuring and operating a Raft ordering service

https://hyperledger-fabric.readthedocs.io/en/latest/raft_configuration.html

Copy: research/sources/raft-configuration.txt

Raft nodes, called consenters, are listed in the channel configuration with their client and server TLS certificates.
Raft nodes identify each other by TLS pinning, so a node cannot run without a valid TLS configuration. The page's
examples use three consenters, and its text on changing the consenter set treats two of three nodes alive as a working
set and two of four alive as no quorum. `consenter-tls-missing` and `raft-consenter-count` lean on it.

### Capabilities

https://hyperledger-fabric.readthedocs.io/en/latest/capabilities_concept.html

Copy: research/sources/capabilities.txt

A node that reads a block with a capability it does not understand stops on purpose, so a capability level names the
lowest binaries that may take part. There are three groupings, Orderer, Application and Channel, each administered by
the parties it concerns. If binaries cannot be upgraded the capabilities stay at their lower levels, and the page
recommends updating the capabilities once the binaries support them. `capabilities-missing` and `capability-disabled`
lean on it.

### Gossip data dissemination protocol

https://hyperledger-fabric.readthedocs.io/en/latest/gossip.html

Copy: research/sources/gossip.txt

Anchor peers let peers of different organizations learn of each other. The page says that communication across
organizations depends on gossip, so at least one anchor peer must be defined in the channel configuration, and strongly
recommends that every organization provides its own set for availability. `anchor-peers-missing` leans on it.

## The Fabric repository

### The sample configtx.yaml

https://github.com/hyperledger/fabric/blob/main/sampleconfig/configtx.yaml

Copy: research/sources/configtx-sample.yaml.txt

The sample file with every section: Organizations, Capabilities, Application, Orderer, Channel and Profiles. A
capability is turned on by setting it to true. The Application, Orderer and Channel sections set Admins to MAJORITY
Admins, Readers and Writers to ANY, and the Application section sets LifecycleEndorsement and Endorsement to MAJORITY
Endorsement. The Orderer section sets BatchTimeout, MaxMessageCount, AbsoluteMaxBytes and PreferredMaxBytes. The note
at the top says Solo, Kafka and the system channel were removed in V3.0, and the Orderer section says the available
types are etcdraft and BFT. A BFT consenter mapping is described as needing at least 3F+1 servers to tolerate F failures,
and four are shown. The organizations of the current sample do not list AnchorPeers. `admins-any`, `endorsement-any`,
`orderer-solo`, `bft-consenter-count`, `batch-settings-missing` and `capabilities-missing` lean on it.
