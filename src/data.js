// The public pages the checks rest on, and the points of each page that the reports show, written in this project's own
// words. A page is named by its address; a copy of its text, read before it was listed, is kept under research/sources.
// research/sources.md lists every page with a note, docs/rules-and-sources.md lists every rule with its points, and
// test/data.test.js checks the three against each other.

export const LEVELS = ['info', 'warning', 'error'];

export const NOTICE = 'This report is an input to a governance review before members join a network: not a security audit and not a guarantee that the network is safe.';

const DOCS = 'https://hyperledger-fabric.readthedocs.io/en/latest';

export const SOURCES = [
  { id: 'policies', title: 'Policies (Hyperledger Fabric documentation)', url: `${DOCS}/policies/policies.html`, file: 'research/sources/policies.txt' },
  { id: 'channel-policies', title: 'Channel policies (Hyperledger Fabric documentation)', url: `${DOCS}/create_channel/channel_policies.html`, file: 'research/sources/channel-policies.txt' },
  { id: 'create-channel-config', title: 'Using configtx.yaml to build a channel configuration (Hyperledger Fabric documentation)', url: `${DOCS}/create_channel/create_channel_config.html`, file: 'research/sources/create-channel-config.txt' },
  { id: 'raft', title: 'Configuring and operating a Raft ordering service (Hyperledger Fabric documentation)', url: `${DOCS}/raft_configuration.html`, file: 'research/sources/raft-configuration.txt' },
  { id: 'capabilities', title: 'Capabilities (Hyperledger Fabric documentation)', url: `${DOCS}/capabilities_concept.html`, file: 'research/sources/capabilities.txt' },
  { id: 'gossip', title: 'Gossip data dissemination protocol (Hyperledger Fabric documentation)', url: `${DOCS}/gossip.html`, file: 'research/sources/gossip.txt' },
  { id: 'sample', title: 'The sample configtx.yaml of the Fabric repository', url: 'https://github.com/hyperledger/fabric/blob/main/sampleconfig/configtx.yaml', file: 'research/sources/configtx-sample.yaml.txt' }
];

// Points: id -> { source, text }.
export const POINTS = {
  'profiles-section': { source: 'create-channel-config', text: 'configtxgen reads the channel profiles in the Profiles section to build a channel configuration, and each profile gathers its data from the other sections of the file.' },
  'modification-policy': { source: 'policies', text: 'Every element of a channel configuration has a modification policy that names who must sign an update, so the policy of a group decides who can change it.' },
  'default-majority-admins': { source: 'policies', text: 'The policies of a group default to a majority of the admins of the group, though any rule may be written.' },
  'admins-majority-sample': { source: 'sample', text: 'The sample file sets Admins to MAJORITY Admins in the Application, Orderer and Channel sections.' },
  'admins-approve-members': { source: 'channel-policies', text: 'With the default policies a majority of organizations must approve adding or removing a channel member, and a majority of orderer organizations must approve adding or removing an ordering node.' },
  'channels-between-orgs': { source: 'channel-policies', text: 'A channel is a private way for organizations to communicate, and most changes to it need the agreement of other members.' },
  'readers-writers-any': { source: 'channel-policies', text: 'The default Readers and Writers policies are ANY, so any organization with the role can read and submit; the Admins and Endorsement defaults are MAJORITY.' },
  'endorsement-majority': { source: 'policies', text: 'The default Endorsement and LifecycleEndorsement policies are MAJORITY Endorsement, and the page says the definition should be customized for a production network.' },
  'lifecycle-endorsement': { source: 'policies', text: 'LifecycleEndorsement governs who must approve a chaincode definition, and Endorsement is the default endorsement policy of a chaincode.' },
  'anchor-peer-required': { source: 'gossip', text: 'Gossip across organizations depends on anchor peers: at least one must be defined in the channel configuration, and every organization is strongly advised to provide its own.' },
  'solo-removed': { source: 'sample', text: 'The sample file says Solo, Kafka and the system channel were removed in V3.0, and that the available orderer types are etcdraft and BFT.' },
  'multi-node-production': { source: 'create-channel-config', text: 'The test network runs one ordering node because it is for development; a production network should use a multi-node ordering service for security and availability.' },
  'raft-consenters-example': { source: 'raft', text: 'The page lists consenters as Raft nodes, shows three of them in a channel, and treats two of three nodes alive as a working set and two of four alive as no quorum.' },
  'bft-consenters': { source: 'sample', text: 'The sample file says a BFT consenter mapping needs at least 3F+1 servers to tolerate F failures, and shows four.' },
  'consenter-identity': { source: 'create-channel-config', text: 'Each consenter is identified by its endpoint and by its client and server TLS certificates, so a multi-node set needs a host, a port and both certificate paths for each node.' },
  'raft-tls-pinning': { source: 'raft', text: 'Raft nodes identify each other by TLS pinning, and a Raft node cannot run without a valid TLS configuration; the certificates in the channel configuration are what the other nodes pin.' },
  'batch-fields': { source: 'create-channel-config', text: 'BatchTimeout and BatchSize (MaxMessageCount, AbsoluteMaxBytes, PreferredMaxBytes) set how large each block is and how often one is cut.' },
  'batch-sample': { source: 'sample', text: 'The sample file sets BatchTimeout, MaxMessageCount, AbsoluteMaxBytes and PreferredMaxBytes in the Orderer section.' },
  'capabilities-groups': { source: 'create-channel-config', text: 'There are three capability groups, Application, Orderer and Channel; each sets the lowest version of the binaries that may take part, and the test network sets all three to V2_0.' },
  'capabilities-purpose': { source: 'capabilities', text: 'A node that reads a block with a capability it does not understand stops on purpose, so a capability level in a channel names the lowest binaries that may take part; the page recommends updating the capabilities once the binaries support them.' },
  'capabilities-sample': { source: 'sample', text: 'The sample file turns a capability on by setting its value to true.' },
  'org-id-mspdir': { source: 'create-channel-config', text: 'The ID is the MSP ID that channel policies and transactions refer to, and the MSPDir is the folder from which the channel MSP is built.' },
  'msp-id-unique': { source: 'create-channel-config', text: 'The MSP ID acts as a unique identifier for an organization.' }
};

export const source = (id) => SOURCES.find((s) => s.id === id);
export const pointPage = (id) => source(POINTS[id].source);
