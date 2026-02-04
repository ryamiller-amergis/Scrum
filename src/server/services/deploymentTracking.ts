import fs from 'fs/promises';
import path from 'path';
import { Deployment, DeploymentEnvironment } from '../types/workitem';
import { v4 as uuidv4 } from 'uuid';

const DEPLOYMENTS_FILE = path.join(process.cwd(), 'public', 'deployments.json');

export interface DeploymentsData {
  deployments: Deployment[];
}

export class DeploymentTrackingService {
  /**
   * Load deployments from JSON file
   */
  private async loadDeployments(): Promise<DeploymentsData> {
    try {
      const data = await fs.readFile(DEPLOYMENTS_FILE, 'utf-8');
      return JSON.parse(data);
    } catch (error: any) {
      // If file doesn't exist, return empty array
      if (error.code === 'ENOENT') {
        return { deployments: [] };
      }
      throw error;
    }
  }

  /**
   * Save deployments to JSON file
   */
  private async saveDeployments(data: DeploymentsData): Promise<void> {
    await fs.writeFile(DEPLOYMENTS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * Create a new deployment record
   */
  async createDeployment(
    releaseVersion: string,
    environment: DeploymentEnvironment,
    workItemIds: number[],
    deployedBy: string,
    notes?: string
  ): Promise<Deployment> {
    const data = await this.loadDeployments();

    const deployment: Deployment = {
      id: uuidv4(),
      releaseVersion,
      environment,
      workItemIds,
      deployedBy,
      deployedAt: new Date().toISOString(),
      notes,
    };

    data.deployments.push(deployment);
    await this.saveDeployments(data);

    return deployment;
  }

  /**
   * Get all deployments for a specific release version
   */
  async getDeploymentsByRelease(releaseVersion: string): Promise<Deployment[]> {
    const data = await this.loadDeployments();
    return data.deployments.filter((d) => d.releaseVersion === releaseVersion);
  }

  /**
   * Get all deployments for a specific environment
   */
  async getDeploymentsByEnvironment(environment: DeploymentEnvironment): Promise<Deployment[]> {
    const data = await this.loadDeployments();
    return data.deployments.filter((d) => d.environment === environment);
  }

  /**
   * Get the latest deployment for each environment for a specific release
   */
  async getLatestDeploymentsByRelease(releaseVersion: string): Promise<{
    dev?: Deployment;
    staging?: Deployment;
    production?: Deployment;
  }> {
    const deployments = await this.getDeploymentsByRelease(releaseVersion);

    const latest: {
      dev?: Deployment;
      staging?: Deployment;
      production?: Deployment;
    } = {};

    // Sort by deployedAt descending
    const sorted = deployments.sort((a, b) => 
      new Date(b.deployedAt).getTime() - new Date(a.deployedAt).getTime()
    );

    // Get latest for each environment
    for (const deployment of sorted) {
      if (!latest[deployment.environment]) {
        latest[deployment.environment] = deployment;
      }
    }

    return latest;
  }

  /**
   * Get all deployments
   */
  async getAllDeployments(): Promise<Deployment[]> {
    const data = await this.loadDeployments();
    return data.deployments.sort((a, b) => 
      new Date(b.deployedAt).getTime() - new Date(a.deployedAt).getTime()
    );
  }

  /**
   * Get deployment history (recent deployments across all releases)
   */
  async getDeploymentHistory(limit: number = 50): Promise<Deployment[]> {
    const deployments = await this.getAllDeployments();
    return deployments.slice(0, limit);
  }
}
