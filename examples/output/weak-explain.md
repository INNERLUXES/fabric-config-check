# fabric-config-check: examples/weak/configtx.yaml

- Input: 227 lines; 3 profiles checked; 5 organizations; 1 construct passed over
- Findings: 24 \(6 error, 16 warning, 2 info\)
- Result: **FAIL - 6 findings at or above error \(6 error, 16 warning, 2 info\)**

## Findings

| Level | Check | Where | Message | Profiles |
| --- | --- | --- | --- | --- |
| error | org-msp-incomplete | examples/weak/configtx.yaml:25 | The organization DockOrg \(MSP ID DockMSP\) has no MSPDir. The documentation uses the ID as the MSP ID that policies refer to and the MSPDir as the folder the channel MSP is built from. Fix: Give the organization its ID and the MSPDir of its MSP folder. | TwoNodeRaft |
| error | org-msp-incomplete | examples/weak/configtx.yaml:49 | The organization QuayOrg has no ID. The documentation uses the ID as the MSP ID that policies refer to and the MSPDir as the folder the channel MSP is built from. Fix: Give the organization its ID and the MSPDir of its MSP folder. | TwoNodeRaft |
| error | duplicate-msp-id | examples/weak/configtx.yaml:62 | The MSP ID HarborMSP is defined for two organizations \(first at line 7\). The documentation calls the MSP ID the unique identifier of an organization. Fix: Give every organization its own MSP ID; use one definition and an alias where the same organization is meant. | BftSmall |
| error | admins-any | examples/weak/configtx.yaml:115 | The Application Admins policy is "ANY Admins", so the admins of any one organization can approve a change to the Application group. The documentation describes Admins as the modification policy and names MAJORITY Admins as the default. Fix: Use MAJORITY Admins, as the sample file does, or a signature policy that names the organizations whose approval is required. | DevSolo and BftSmall |
| error | orderer-solo | examples/weak/configtx.yaml:163 | OrdererType is solo. The current sample file says Solo was removed in V3.0, and the documentation says a production network should use a multi-node ordering service. Fix: Use etcdraft, or BFT where the release supports it, with several ordering nodes. | DevSolo |
| error | consenter-tls-missing | examples/weak/configtx.yaml:186 | The consenter raft.harbor.test:7060 in EtcdRaft.Consenters has no ServerTLSCert. The documentation identifies each consenter by its endpoint and its client and server TLS certificates. Fix: Give every consenter both certificate paths, as the Raft page shows. | TwoNodeRaft |
| warning | anchor-peers-missing | examples/weak/configtx.yaml:6 | The organization HarborOrg \(MSP ID HarborMSP\) is used in the Application section and has no AnchorPeers. The documentation says at least one anchor peer must be defined in the channel configuration for gossip across organizations. Fix: Give the organization AnchorPeers, or set its anchor peers in a channel update after the channel exists; the pages say at least one must be defined in the channel configuration. | DevSolo and BftSmall |
| warning | unsupported-construct | examples/weak/configtx.yaml:27 | Not read: a block scalar \(\| or \>\) \(Description: \|\). What it holds was not checked. Fix: Write the value in the plain form, or check that part by hand. |  |
| warning | capability-disabled | examples/weak/configtx.yaml:94 | The Orderer Capabilities group has no level set to true \(V2\_0: false\), so it requires nothing of the binaries. Fix: Set the level the binaries of the network support to true. | DevSolo and BftSmall |
| warning | endorsement-any | examples/weak/configtx.yaml:103 | The Application LifecycleEndorsement policy is "ANY Endorsement", so one organization can approve a chaincode definition. The documentation default is MAJORITY Endorsement and it says the definition should be customized in production. Fix: Use MAJORITY Endorsement, as the sample file does, or a signature policy that names who must endorse. | DevSolo and BftSmall |
| warning | batch-settings-missing | examples/weak/configtx.yaml:123 | BatchSize sets no PreferredMaxBytes. The documentation and the sample file set all three values of BatchSize. Fix: Set BatchTimeout and BatchSize with MaxMessageCount, AbsoluteMaxBytes and PreferredMaxBytes, as the sample file does. | DevSolo and BftSmall |
| warning | single-organization | examples/weak/configtx.yaml:168 | The Application section lists one organization, HarborOrg \(MSP ID HarborMSP\), so no other organization takes part in the channel. This is a best practice of this tool, not a rule in the Fabric documentation. Fix: List every organization that is to be a member, so that the policies have more than one party to agree. | DevSolo |
| warning | single-organization | examples/weak/configtx.yaml:172 | The consortium HarborConsortium lists one organization, HarborOrg \(MSP ID HarborMSP\), so no other organization is a member. This is a best practice of this tool, not a rule in the Fabric documentation. Fix: List every organization that is to be a member, so that the policies have more than one party to agree. | DevSolo |
| warning | capabilities-missing | examples/weak/configtx.yaml:177 | The Channel group has no Capabilities, so the channel does not say which level of binaries may take part. The documentation sets all three groups. Fix: Add Capabilities with the level the binaries of the network support, set to true. | TwoNodeRaft |
| warning | batch-settings-missing | examples/weak/configtx.yaml:178 | The Orderer section sets no BatchTimeout. The documentation and the sample file set it to say how often a block is cut. Fix: Set BatchTimeout and BatchSize with MaxMessageCount, AbsoluteMaxBytes and PreferredMaxBytes, as the sample file does. | TwoNodeRaft |
| warning | batch-settings-missing | examples/weak/configtx.yaml:178 | The Orderer section sets no BatchSize. The documentation and the sample file set MaxMessageCount, AbsoluteMaxBytes and PreferredMaxBytes to say how large a block is. Fix: Set BatchTimeout and BatchSize with MaxMessageCount, AbsoluteMaxBytes and PreferredMaxBytes, as the sample file does. | TwoNodeRaft |
| warning | capabilities-missing | examples/weak/configtx.yaml:178 | The Orderer group has no Capabilities, so the channel does not say which level of binaries may take part. The documentation sets all three groups. Fix: Add Capabilities with the level the binaries of the network support, set to true. | TwoNodeRaft |
| warning | consenters-single-host | examples/weak/configtx.yaml:181 | All 2 consenters in EtcdRaft.Consenters are on the host raft.harbor.test, so one host failure stops ordering. This is a best practice of this tool, not a rule in the Fabric documentation. Fix: Put each consenter on its own host, so that one failure cannot stop ordering. | TwoNodeRaft |
| warning | raft-consenter-count | examples/weak/configtx.yaml:181 | EtcdRaft.Consenters lists 2 consenters. The documentation says a production network should use a multi-node ordering service and shows a set of three; a majority of consenters must be up to order. The minimum of 3 is a best practice of this tool. Fix: List at least three consenters, each on its own host. | TwoNodeRaft |
| warning | capabilities-missing | examples/weak/configtx.yaml:191 | The Application group has no Capabilities, so the channel does not say which level of binaries may take part. The documentation sets all three groups. Fix: Add Capabilities with the level the binaries of the network support, set to true. | TwoNodeRaft |
| warning | bft-consenter-count | examples/weak/configtx.yaml:202 | ConsenterMapping lists 3 consenters. The sample file says a BFT set needs at least 3F\+1 servers to tolerate F failures, so at least four for one failure. Fix: List at least 3F\+1 consenters for the F failures the network is to tolerate, so at least four. | BftSmall |
| warning | single-organization | examples/weak/configtx.yaml:225 | The Application section lists one organization, HarborOrg \(MSP ID HarborMSP\), so no other organization takes part in the channel. This is a best practice of this tool, not a rule in the Fabric documentation. Fix: List every organization that is to be a member, so that the policies have more than one party to agree. | BftSmall |
| info | readers-writers-any | examples/weak/configtx.yaml:109 | The Application Readers and Writers policies are "ANY Readers" and "ANY Writers", so any one organization can read and submit. The documentation defaults are ANY, so confirm it is intended. This is a best practice of this tool, not a rule in the Fabric documentation. Fix: Confirm that open reading and submitting is intended. The documentation defaults are ANY, and MAJORITY on Writers would need several organizations to sign every submission, so this is a note and not a fault. | DevSolo and BftSmall |
| info | readers-writers-any | examples/weak/configtx.yaml:130 | The Orderer Readers and Writers policies are "ANY Readers" and "ANY Writers", so any one organization can read and submit. The documentation defaults are ANY, so confirm it is intended. This is a best practice of this tool, not a rule in the Fabric documentation. Fix: Confirm that open reading and submitting is intended. The documentation defaults are ANY, and MAJORITY on Writers would need several organizations to sign every submission, so this is a note and not a fault. | DevSolo and BftSmall |

## Basis

### org-msp-incomplete

- The ID is the MSP ID that channel policies and transactions refer to, and the MSPDir is the folder from which the channel MSP is built. (Using configtx.yaml to build a channel configuration \(Hyperledger Fabric documentation\), <https://hyperledger-fabric.readthedocs.io/en/latest/create_channel/create_channel_config.html>)

### duplicate-msp-id

- The MSP ID acts as a unique identifier for an organization. (Using configtx.yaml to build a channel configuration \(Hyperledger Fabric documentation\), <https://hyperledger-fabric.readthedocs.io/en/latest/create_channel/create_channel_config.html>)
- The ID is the MSP ID that channel policies and transactions refer to, and the MSPDir is the folder from which the channel MSP is built. (Using configtx.yaml to build a channel configuration \(Hyperledger Fabric documentation\), <https://hyperledger-fabric.readthedocs.io/en/latest/create_channel/create_channel_config.html>)

### admins-any

- Every element of a channel configuration has a modification policy that names who must sign an update, so the policy of a group decides who can change it. (Policies \(Hyperledger Fabric documentation\), <https://hyperledger-fabric.readthedocs.io/en/latest/policies/policies.html>)
- The policies of a group default to a majority of the admins of the group, though any rule may be written. (Policies \(Hyperledger Fabric documentation\), <https://hyperledger-fabric.readthedocs.io/en/latest/policies/policies.html>)
- The sample file sets Admins to MAJORITY Admins in the Application, Orderer and Channel sections. (The sample configtx.yaml of the Fabric repository, <https://github.com/hyperledger/fabric/blob/main/sampleconfig/configtx.yaml>)
- With the default policies a majority of organizations must approve adding or removing a channel member, and a majority of orderer organizations must approve adding or removing an ordering node. (Channel policies \(Hyperledger Fabric documentation\), <https://hyperledger-fabric.readthedocs.io/en/latest/create_channel/channel_policies.html>)

### orderer-solo

- The sample file says Solo, Kafka and the system channel were removed in V3.0, and that the available orderer types are etcdraft and BFT. (The sample configtx.yaml of the Fabric repository, <https://github.com/hyperledger/fabric/blob/main/sampleconfig/configtx.yaml>)
- The test network runs one ordering node because it is for development; a production network should use a multi-node ordering service for security and availability. (Using configtx.yaml to build a channel configuration \(Hyperledger Fabric documentation\), <https://hyperledger-fabric.readthedocs.io/en/latest/create_channel/create_channel_config.html>)

### consenter-tls-missing

- Each consenter is identified by its endpoint and by its client and server TLS certificates, so a multi-node set needs a host, a port and both certificate paths for each node. (Using configtx.yaml to build a channel configuration \(Hyperledger Fabric documentation\), <https://hyperledger-fabric.readthedocs.io/en/latest/create_channel/create_channel_config.html>)
- Raft nodes identify each other by TLS pinning, and a Raft node cannot run without a valid TLS configuration; the certificates in the channel configuration are what the other nodes pin. (Configuring and operating a Raft ordering service \(Hyperledger Fabric documentation\), <https://hyperledger-fabric.readthedocs.io/en/latest/raft_configuration.html>)

### anchor-peers-missing

- Gossip across organizations depends on anchor peers: at least one must be defined in the channel configuration, and every organization is strongly advised to provide its own. (Gossip data dissemination protocol \(Hyperledger Fabric documentation\), <https://hyperledger-fabric.readthedocs.io/en/latest/gossip.html>)
- The tool's own choice: the current sample file no longer lists AnchorPeers, so a file written for the current release may set them in a channel update instead; the check cannot see a later update

### unsupported-construct


### capability-disabled

- There are three capability groups, Application, Orderer and Channel; each sets the lowest version of the binaries that may take part, and the test network sets all three to V2\_0. (Using configtx.yaml to build a channel configuration \(Hyperledger Fabric documentation\), <https://hyperledger-fabric.readthedocs.io/en/latest/create_channel/create_channel_config.html>)
- A node that reads a block with a capability it does not understand stops on purpose, so a capability level in a channel names the lowest binaries that may take part; the page recommends updating the capabilities once the binaries support them. (Capabilities \(Hyperledger Fabric documentation\), <https://hyperledger-fabric.readthedocs.io/en/latest/capabilities_concept.html>)
- The sample file turns a capability on by setting its value to true. (The sample configtx.yaml of the Fabric repository, <https://github.com/hyperledger/fabric/blob/main/sampleconfig/configtx.yaml>)

### endorsement-any

- The default Endorsement and LifecycleEndorsement policies are MAJORITY Endorsement, and the page says the definition should be customized for a production network. (Policies \(Hyperledger Fabric documentation\), <https://hyperledger-fabric.readthedocs.io/en/latest/policies/policies.html>)
- LifecycleEndorsement governs who must approve a chaincode definition, and Endorsement is the default endorsement policy of a chaincode. (Policies \(Hyperledger Fabric documentation\), <https://hyperledger-fabric.readthedocs.io/en/latest/policies/policies.html>)

### batch-settings-missing

- BatchTimeout and BatchSize \(MaxMessageCount, AbsoluteMaxBytes, PreferredMaxBytes\) set how large each block is and how often one is cut. (Using configtx.yaml to build a channel configuration \(Hyperledger Fabric documentation\), <https://hyperledger-fabric.readthedocs.io/en/latest/create_channel/create_channel_config.html>)
- The sample file sets BatchTimeout, MaxMessageCount, AbsoluteMaxBytes and PreferredMaxBytes in the Orderer section. (The sample configtx.yaml of the Fabric repository, <https://github.com/hyperledger/fabric/blob/main/sampleconfig/configtx.yaml>)
- The tool's own choice: the tool does not know the values configtxgen fills in when a setting is left out, because the pages it reads do not say, so it asks for them to be written

### single-organization

- A channel is a private way for organizations to communicate, and most changes to it need the agreement of other members. (Channel policies \(Hyperledger Fabric documentation\), <https://hyperledger-fabric.readthedocs.io/en/latest/create_channel/channel_policies.html>)
- With the default policies a majority of organizations must approve adding or removing a channel member, and a majority of orderer organizations must approve adding or removing an ordering node. (Channel policies \(Hyperledger Fabric documentation\), <https://hyperledger-fabric.readthedocs.io/en/latest/create_channel/channel_policies.html>)
- The tool's own choice: the count of one is a best practice of this tool, not a rule in the Fabric documentation; the page says a channel is a way for organizations to communicate

### capabilities-missing

- There are three capability groups, Application, Orderer and Channel; each sets the lowest version of the binaries that may take part, and the test network sets all three to V2\_0. (Using configtx.yaml to build a channel configuration \(Hyperledger Fabric documentation\), <https://hyperledger-fabric.readthedocs.io/en/latest/create_channel/create_channel_config.html>)
- A node that reads a block with a capability it does not understand stops on purpose, so a capability level in a channel names the lowest binaries that may take part; the page recommends updating the capabilities once the binaries support them. (Capabilities \(Hyperledger Fabric documentation\), <https://hyperledger-fabric.readthedocs.io/en/latest/capabilities_concept.html>)
- The sample file turns a capability on by setting its value to true. (The sample configtx.yaml of the Fabric repository, <https://github.com/hyperledger/fabric/blob/main/sampleconfig/configtx.yaml>)

### consenters-single-host

- The page lists consenters as Raft nodes, shows three of them in a channel, and treats two of three nodes alive as a working set and two of four alive as no quorum. (Configuring and operating a Raft ordering service \(Hyperledger Fabric documentation\), <https://hyperledger-fabric.readthedocs.io/en/latest/raft_configuration.html>)
- The tool's own choice: the idea that consenters should not share a host is a best practice of this tool, not a rule in the Fabric documentation

### raft-consenter-count

- The page lists consenters as Raft nodes, shows three of them in a channel, and treats two of three nodes alive as a working set and two of four alive as no quorum. (Configuring and operating a Raft ordering service \(Hyperledger Fabric documentation\), <https://hyperledger-fabric.readthedocs.io/en/latest/raft_configuration.html>)
- The test network runs one ordering node because it is for development; a production network should use a multi-node ordering service for security and availability. (Using configtx.yaml to build a channel configuration \(Hyperledger Fabric documentation\), <https://hyperledger-fabric.readthedocs.io/en/latest/create_channel/create_channel_config.html>)
- The tool's own choice: the threshold of three is a best practice of this tool, not a rule in the Fabric documentation; the documentation says a production network should use a multi-node ordering service

### bft-consenter-count

- The sample file says a BFT consenter mapping needs at least 3F\+1 servers to tolerate F failures, and shows four. (The sample configtx.yaml of the Fabric repository, <https://github.com/hyperledger/fabric/blob/main/sampleconfig/configtx.yaml>)

### readers-writers-any

- The default Readers and Writers policies are ANY, so any organization with the role can read and submit; the Admins and Endorsement defaults are MAJORITY. (Channel policies \(Hyperledger Fabric documentation\), <https://hyperledger-fabric.readthedocs.io/en/latest/create_channel/channel_policies.html>)
- The tool's own choice: treating ANY as worth a look is a best practice of this tool, not a rule in the Fabric documentation; the documentation defaults are ANY

## Not read

- examples/weak/configtx.yaml:27: a block scalar \(\| or \>\)

Note: 1 construct was passed over by the reader; each is listed as an unsupported-construct finding and what it holds was not checked

This report is an input to a governance review before members join a network: not a security audit and not a guarantee that the network is safe.
