#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { Wso2MiDashboardStack } from '../lib/wso2-mi-dashboard-stack';

const app = new cdk.App();
new Wso2MiDashboardStack(app, 'Wso2MiDashboardStack', {
	env: { account: '858735049384', region: 'af-south-1' },
    stackName: 'micro-integrator-dashboard',
    description: 'The Micro Integrator dashboard provides a graphical view of the synapse artifacts that are deployed in a specified Micro Integrator server instance'
});