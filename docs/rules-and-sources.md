# Rules and sources

Every check of the tool, with what it looks at, the points of the public pages it rests on, what it cannot see, and what to change. The points are in this project's own words and are the ones the reports show with `--explain`; each page was fetched and read before it was listed, and a copy of its text is kept under [research/sources](../research/sources) so that a point can be checked against the page it came from. [../research/sources.md](../research/sources.md) has a note on each page.

The tool is an input to a governance review before members join a network: not a security audit and not a guarantee that the network is safe. A check that is a best practice of this tool says so in its message; it is not a rule in the Fabric documentation.

## The pages

- Policies (Hyperledger Fabric documentation): https://hyperledger-fabric.readthedocs.io/en/latest/policies/policies.html (copy: `research/sources/policies.txt`)
- Channel policies (Hyperledger Fabric documentation): https://hyperledger-fabric.readthedocs.io/en/latest/create_channel/channel_policies.html (copy: `research/sources/channel-policies.txt`)
- Using configtx.yaml to build a channel configuration (Hyperledger Fabric documentation): https://hyperledger-fabric.readthedocs.io/en/latest/create_channel/create_channel_config.html (copy: `research/sources/create-channel-config.txt`)
- Configuring and operating a Raft ordering service (Hyperledger Fabric documentation): https://hyperledger-fabric.readthedocs.io/en/latest/raft_configuration.html (copy: `research/sources/raft-configuration.txt`)
- Capabilities (Hyperledger Fabric documentation): https://hyperledger-fabric.readthedocs.io/en/latest/capabilities_concept.html (copy: `research/sources/capabilities.txt`)
- Gossip data dissemination protocol (Hyperledger Fabric documentation): https://hyperledger-fabric.readthedocs.io/en/latest/gossip.html (copy: `research/sources/gossip.txt`)
- The sample configtx.yaml of the Fabric repository: https://github.com/hyperledger/fabric/blob/main/sampleconfig/configtx.yaml (copy: `research/sources/configtx-sample.yaml.txt`)

## config-unreadable

- Level: error
- Kind: a problem with the file itself; it has no setting to lower
- Looks at: the file is not YAML the reader can follow (a tab in the indentation, a duplicate key, an alias with no anchor, a line outside the structure).
- Cannot see: It stops at the first line that is not well formed, so nothing after that line is checked.
- What to change: Fix the line named, or keep the file to the YAML that configtx.yaml files use (docs/inputs.md).
- Points of the pages: none; this check is about the file itself.

## unsupported-construct

- Level: warning
- Kind: a problem with the file itself; it has no setting to lower
- Looks at: the file holds a YAML construct the reader passes over (a block scalar, a tag, a complex key, a second document, a quoted string over several lines); what it holds was not checked.
- Cannot see: It names the construct and its line; it does not say what the construct holds.
- What to change: Write the value in the plain form, or check that part by hand.
- Points of the pages: none; this check is about the file itself.

## no-profiles

- Level: error
- Kind: a problem with the file itself; it has no setting to lower
- Looks at: the file has no Profiles section with a profile in it, so there is no channel or consortium to check.
- Cannot see: It cannot tell whether the profiles are in another file.
- What to change: Add the profiles the network is built from, or give the file that holds them.
- Points of the pages:
  - configtxgen reads the channel profiles in the Profiles section to build a channel configuration, and each profile gathers its data from the other sections of the file. (Using configtx.yaml to build a channel configuration (Hyperledger Fabric documentation), https://hyperledger-fabric.readthedocs.io/en/latest/create_channel/create_channel_config.html)

## single-organization

- Level: warning
- Kind: best practice of this tool, not a rule in the Fabric documentation
- Looks at: the Application section of a profile, or a consortium, lists one organization.
- Cannot see: It counts the organizations written in the file; members added later by a channel update are not seen. It counts by MSP ID, and an organization with no ID is counted as its own definition.
- What to change: List every organization that is to be a member, so that the policies have more than one party to agree.
- The tool's own choice: the count of one is a best practice of this tool, not a rule in the Fabric documentation; the page says a channel is a way for organizations to communicate.
- Points of the pages:
  - A channel is a private way for organizations to communicate, and most changes to it need the agreement of other members. (Channel policies (Hyperledger Fabric documentation), https://hyperledger-fabric.readthedocs.io/en/latest/create_channel/channel_policies.html)
  - With the default policies a majority of organizations must approve adding or removing a channel member, and a majority of orderer organizations must approve adding or removing an ordering node. (Channel policies (Hyperledger Fabric documentation), https://hyperledger-fabric.readthedocs.io/en/latest/create_channel/channel_policies.html)

## admins-any

- Level: error
- Kind: documented
- Looks at: the Admins policy of the Application, Orderer or Channel section is ANY Admins, so the admins of any one organization can approve a change to that group.
- Cannot see: It compares the text of an ImplicitMeta rule. A signature rule on Admins, and the Admins policy of an organization, are not read.
- What to change: Use MAJORITY Admins, as the sample file does, or a signature policy that names the organizations whose approval is required.
- Points of the pages:
  - Every element of a channel configuration has a modification policy that names who must sign an update, so the policy of a group decides who can change it. (Policies (Hyperledger Fabric documentation), https://hyperledger-fabric.readthedocs.io/en/latest/policies/policies.html)
  - The policies of a group default to a majority of the admins of the group, though any rule may be written. (Policies (Hyperledger Fabric documentation), https://hyperledger-fabric.readthedocs.io/en/latest/policies/policies.html)
  - The sample file sets Admins to MAJORITY Admins in the Application, Orderer and Channel sections. (The sample configtx.yaml of the Fabric repository, https://github.com/hyperledger/fabric/blob/main/sampleconfig/configtx.yaml)
  - With the default policies a majority of organizations must approve adding or removing a channel member, and a majority of orderer organizations must approve adding or removing an ordering node. (Channel policies (Hyperledger Fabric documentation), https://hyperledger-fabric.readthedocs.io/en/latest/create_channel/channel_policies.html)

## readers-writers-any

- Level: info
- Kind: best practice of this tool, not a rule in the Fabric documentation
- Looks at: a Readers or Writers policy of the Application, Orderer or Channel section is ANY, which lets any one organization read or submit.
- Cannot see: It compares rule text only, and does not know who the organizations are or what ACLs point at these policies.
- What to change: Confirm that open reading and submitting is intended. The documentation defaults are ANY, and MAJORITY on Writers would need several organizations to sign every submission, so this is a note and not a fault.
- The tool's own choice: treating ANY as worth a look is a best practice of this tool, not a rule in the Fabric documentation; the documentation defaults are ANY.
- Points of the pages:
  - The default Readers and Writers policies are ANY, so any organization with the role can read and submit; the Admins and Endorsement defaults are MAJORITY. (Channel policies (Hyperledger Fabric documentation), https://hyperledger-fabric.readthedocs.io/en/latest/create_channel/channel_policies.html)

## endorsement-any

- Level: warning
- Kind: documented
- Looks at: the LifecycleEndorsement or Endorsement policy of the Application section is ANY, so one organization can approve a chaincode definition or endorse a transaction.
- Cannot see: It reads the channel-level policies only. The endorsement policy committed with a chaincode definition is not in the file.
- What to change: Use MAJORITY Endorsement, as the sample file does, or a signature policy that names who must endorse.
- Points of the pages:
  - The default Endorsement and LifecycleEndorsement policies are MAJORITY Endorsement, and the page says the definition should be customized for a production network. (Policies (Hyperledger Fabric documentation), https://hyperledger-fabric.readthedocs.io/en/latest/policies/policies.html)
  - LifecycleEndorsement governs who must approve a chaincode definition, and Endorsement is the default endorsement policy of a chaincode. (Policies (Hyperledger Fabric documentation), https://hyperledger-fabric.readthedocs.io/en/latest/policies/policies.html)

## anchor-peers-missing

- Level: warning
- Kind: documented
- Looks at: an organization used in the Application section of a profile has no AnchorPeers.
- Cannot see: It reads AnchorPeers in the file. A channel update can set them after the channel exists, and the current sample file does not list them.
- What to change: Give the organization AnchorPeers, or set its anchor peers in a channel update after the channel exists; the pages say at least one must be defined in the channel configuration.
- The tool's own choice: the current sample file no longer lists AnchorPeers, so a file written for the current release may set them in a channel update instead; the check cannot see a later update.
- Points of the pages:
  - Gossip across organizations depends on anchor peers: at least one must be defined in the channel configuration, and every organization is strongly advised to provide its own. (Gossip data dissemination protocol (Hyperledger Fabric documentation), https://hyperledger-fabric.readthedocs.io/en/latest/gossip.html)

## orderer-solo

- Level: error
- Kind: documented
- Looks at: the OrdererType of a profile is solo.
- Cannot see: It reads OrdererType as written. It does not know which release the network runs.
- What to change: Use etcdraft, or BFT where the release supports it, with several ordering nodes.
- Points of the pages:
  - The sample file says Solo, Kafka and the system channel were removed in V3.0, and that the available orderer types are etcdraft and BFT. (The sample configtx.yaml of the Fabric repository, https://github.com/hyperledger/fabric/blob/main/sampleconfig/configtx.yaml)
  - The test network runs one ordering node because it is for development; a production network should use a multi-node ordering service for security and availability. (Using configtx.yaml to build a channel configuration (Hyperledger Fabric documentation), https://hyperledger-fabric.readthedocs.io/en/latest/create_channel/create_channel_config.html)

## raft-consenter-count

- Level: warning
- Kind: best practice of this tool, not a rule in the Fabric documentation
- Looks at: an etcdraft profile lists fewer than 3 consenters, or none.
- Cannot see: It counts the consenters written in the file; consenters added or removed by a channel update are not seen.
- What to change: List at least three consenters, each on its own host.
- The tool's own choice: the threshold of three is a best practice of this tool, not a rule in the Fabric documentation; the documentation says a production network should use a multi-node ordering service.
- Points of the pages:
  - The page lists consenters as Raft nodes, shows three of them in a channel, and treats two of three nodes alive as a working set and two of four alive as no quorum. (Configuring and operating a Raft ordering service (Hyperledger Fabric documentation), https://hyperledger-fabric.readthedocs.io/en/latest/raft_configuration.html)
  - The test network runs one ordering node because it is for development; a production network should use a multi-node ordering service for security and availability. (Using configtx.yaml to build a channel configuration (Hyperledger Fabric documentation), https://hyperledger-fabric.readthedocs.io/en/latest/create_channel/create_channel_config.html)

## bft-consenter-count

- Level: warning
- Kind: documented
- Looks at: a BFT profile lists fewer than 4 consenters in its ConsenterMapping.
- Cannot see: It counts the entries of ConsenterMapping written in the file.
- What to change: List at least 3F+1 consenters for the F failures the network is to tolerate, so at least four.
- Points of the pages:
  - The sample file says a BFT consenter mapping needs at least 3F+1 servers to tolerate F failures, and shows four. (The sample configtx.yaml of the Fabric repository, https://github.com/hyperledger/fabric/blob/main/sampleconfig/configtx.yaml)

## consenters-single-host

- Level: warning
- Kind: best practice of this tool, not a rule in the Fabric documentation
- Looks at: all the consenters of a profile are on one host.
- Cannot see: It compares the written Host values; two names for one machine, or one name that fronts several machines, look different or the same.
- What to change: Put each consenter on its own host, so that one failure cannot stop ordering.
- The tool's own choice: the idea that consenters should not share a host is a best practice of this tool, not a rule in the Fabric documentation.
- Points of the pages:
  - The page lists consenters as Raft nodes, shows three of them in a channel, and treats two of three nodes alive as a working set and two of four alive as no quorum. (Configuring and operating a Raft ordering service (Hyperledger Fabric documentation), https://hyperledger-fabric.readthedocs.io/en/latest/raft_configuration.html)

## consenter-tls-missing

- Level: error
- Kind: documented
- Looks at: a consenter has no ClientTLSCert or no ServerTLSCert.
- Cannot see: It checks that the paths are written, not that they point at files or that the certificates are valid.
- What to change: Give every consenter both certificate paths, as the Raft page shows.
- Points of the pages:
  - Each consenter is identified by its endpoint and by its client and server TLS certificates, so a multi-node set needs a host, a port and both certificate paths for each node. (Using configtx.yaml to build a channel configuration (Hyperledger Fabric documentation), https://hyperledger-fabric.readthedocs.io/en/latest/create_channel/create_channel_config.html)
  - Raft nodes identify each other by TLS pinning, and a Raft node cannot run without a valid TLS configuration; the certificates in the channel configuration are what the other nodes pin. (Configuring and operating a Raft ordering service (Hyperledger Fabric documentation), https://hyperledger-fabric.readthedocs.io/en/latest/raft_configuration.html)

## batch-settings-missing

- Level: warning
- Kind: documented
- Looks at: the Orderer section of a profile sets no BatchTimeout, or no BatchSize or one of its three values.
- Cannot see: It does not know the values the binary fills in, and does not judge the values written.
- What to change: Set BatchTimeout and BatchSize with MaxMessageCount, AbsoluteMaxBytes and PreferredMaxBytes, as the sample file does.
- The tool's own choice: the tool does not know the values configtxgen fills in when a setting is left out, because the pages it reads do not say, so it asks for them to be written.
- Points of the pages:
  - BatchTimeout and BatchSize (MaxMessageCount, AbsoluteMaxBytes, PreferredMaxBytes) set how large each block is and how often one is cut. (Using configtx.yaml to build a channel configuration (Hyperledger Fabric documentation), https://hyperledger-fabric.readthedocs.io/en/latest/create_channel/create_channel_config.html)
  - The sample file sets BatchTimeout, MaxMessageCount, AbsoluteMaxBytes and PreferredMaxBytes in the Orderer section. (The sample configtx.yaml of the Fabric repository, https://github.com/hyperledger/fabric/blob/main/sampleconfig/configtx.yaml)

## capabilities-missing

- Level: warning
- Kind: documented
- Looks at: a profile has no Capabilities for its Channel, Application or Orderer group.
- Cannot see: It does not know which level the binaries support, and does not ask for a particular one.
- What to change: Add Capabilities with the level the binaries of the network support, set to true.
- Points of the pages:
  - There are three capability groups, Application, Orderer and Channel; each sets the lowest version of the binaries that may take part, and the test network sets all three to V2_0. (Using configtx.yaml to build a channel configuration (Hyperledger Fabric documentation), https://hyperledger-fabric.readthedocs.io/en/latest/create_channel/create_channel_config.html)
  - A node that reads a block with a capability it does not understand stops on purpose, so a capability level in a channel names the lowest binaries that may take part; the page recommends updating the capabilities once the binaries support them. (Capabilities (Hyperledger Fabric documentation), https://hyperledger-fabric.readthedocs.io/en/latest/capabilities_concept.html)
  - The sample file turns a capability on by setting its value to true. (The sample configtx.yaml of the Fabric repository, https://github.com/hyperledger/fabric/blob/main/sampleconfig/configtx.yaml)

## capability-disabled

- Level: warning
- Kind: documented
- Looks at: a Capabilities group of a profile has no level set to true (for example V2_0: false).
- Cannot see: It reads only the boolean true as enabled.
- What to change: Set the level the binaries of the network support to true.
- Points of the pages:
  - There are three capability groups, Application, Orderer and Channel; each sets the lowest version of the binaries that may take part, and the test network sets all three to V2_0. (Using configtx.yaml to build a channel configuration (Hyperledger Fabric documentation), https://hyperledger-fabric.readthedocs.io/en/latest/create_channel/create_channel_config.html)
  - A node that reads a block with a capability it does not understand stops on purpose, so a capability level in a channel names the lowest binaries that may take part; the page recommends updating the capabilities once the binaries support them. (Capabilities (Hyperledger Fabric documentation), https://hyperledger-fabric.readthedocs.io/en/latest/capabilities_concept.html)
  - The sample file turns a capability on by setting its value to true. (The sample configtx.yaml of the Fabric repository, https://github.com/hyperledger/fabric/blob/main/sampleconfig/configtx.yaml)

## org-msp-incomplete

- Level: error
- Kind: documented
- Looks at: an organization has no ID or no MSPDir.
- Cannot see: It checks that ID and MSPDir are written, not that the MSP folder exists or is complete.
- What to change: Give the organization its ID and the MSPDir of its MSP folder.
- Points of the pages:
  - The ID is the MSP ID that channel policies and transactions refer to, and the MSPDir is the folder from which the channel MSP is built. (Using configtx.yaml to build a channel configuration (Hyperledger Fabric documentation), https://hyperledger-fabric.readthedocs.io/en/latest/create_channel/create_channel_config.html)

## duplicate-msp-id

- Level: error
- Kind: documented
- Looks at: two organization definitions have the same MSP ID.
- Cannot see: It compares the IDs written in the file; the same ID spelled with different case is two IDs.
- What to change: Give every organization its own MSP ID; use one definition and an alias where the same organization is meant.
- Points of the pages:
  - The MSP ID acts as a unique identifier for an organization. (Using configtx.yaml to build a channel configuration (Hyperledger Fabric documentation), https://hyperledger-fabric.readthedocs.io/en/latest/create_channel/create_channel_config.html)
  - The ID is the MSP ID that channel policies and transactions refer to, and the MSPDir is the folder from which the channel MSP is built. (Using configtx.yaml to build a channel configuration (Hyperledger Fabric documentation), https://hyperledger-fabric.readthedocs.io/en/latest/create_channel/create_channel_config.html)
