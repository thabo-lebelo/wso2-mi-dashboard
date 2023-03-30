import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2'
import * as acm from "aws-cdk-lib/aws-certificatemanager";

export class Wso2MiDashboardStack extends cdk.Stack {
	constructor(scope: Construct, id: string, props?: cdk.StackProps) {
		super(scope, id, props);

		const vpc = ec2.Vpc.fromLookup(this, 'VPC', {
			vpcName: 'wso2-vpc',
		});

		const cluster = new ecs.Cluster(this, "Cluster", {
			vpc: vpc,
			clusterName: "mi-dasboard-cluster",
		});

		const alb = new elbv2.ApplicationLoadBalancer(this, 'ALB', {
			vpc: vpc,
			internetFacing: true,
			loadBalancerName: 'mi-dasboard-load-balancer'
		});

		/* DNS, DOMAINS, CERTS */
		// I'm using a domain I own: sovhubb.com
		const zone = route53.HostedZone.fromLookup(this, 'HostedZone', {
			domainName: 'sovhubb.com'
		});

		const cert = new acm.Certificate(this, 'Certificate', {
            domainName: 'wso2mi-dashboard.sovhubb.com',
            validation: acm.CertificateValidation.fromDns(zone)
        });

		// Create DNS record to point to the load balancer
        new route53.ARecord(this, 'DNS', {
            zone: zone,
            target: route53.RecordTarget.fromAlias(
                new route53Targets.LoadBalancerTarget(alb)
            ),
            ttl: cdk.Duration.seconds(300),
            comment: 'URL to access the Micro Integrator Dashboard',
            recordName: 'wso2mi-dashboard'
        })


		const repo = ecr.Repository.fromRepositoryArn(this, "Repo",
			"arn:aws:ecr:af-south-1:858735049384:repository/wso2mi-dashboard"
		);

		const image = ecs.ContainerImage.fromEcrRepository(repo, 'latest');

		const task = new ecs.TaskDefinition(this, 'Task', {
			cpu: "1024",
			memoryMiB: "2048",
			compatibility: ecs.Compatibility.EC2_AND_FARGATE,
			networkMode: ecs.NetworkMode.AWS_VPC
		});

		const container = task.addContainer('Container', {
			memoryLimitMiB: 1024,
			image: image,
			logging: ecs.LogDriver.awsLogs({ streamPrefix: "wso2mi-dashboard" })
		});

		container.addPortMappings({
			containerPort: 9743,
			protocol: ecs.Protocol.TCP
		});

		const service = new ecs.FargateService(this, "Service", {
			cluster: cluster,
			taskDefinition: task,
			serviceName: 'wso2mi-dashboard',
		});

		const scaling = service.autoScaleTaskCount({ maxCapacity: 3, minCapacity: 1 });

		// Auto-Scaling depending on CPU utilization
		scaling.scaleOnCpuUtilization('autoscale', {
			targetUtilizationPercent: 50,
			scaleInCooldown: cdk.Duration.minutes(2),
			scaleOutCooldown: cdk.Duration.seconds(30)
		});

		/* CONFIGURE ALB DEFAULT LISTENER */
		const port9743Listener = alb.addListener('port9743Listener', {
			port: 9743,
			certificates: [cert],
			protocol: elbv2.ApplicationProtocol.HTTPS,
		});

		port9743Listener.addTargets('service', {
			port: 9743,
			targets: [service],
			protocol: elbv2.ApplicationProtocol.HTTPS,
			targetGroupName: 'wso2mi-dashboard',
		});




	}
}
