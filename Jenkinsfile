pipeline {
    agent { label 'ec2-build-node' }
    environment {
        HOST_PATH = credentials('host-path')
        HOST = credentials('host')
    }
    stages {
        stage('Clone repository') {
            steps {
                checkout scm
            }
        }
        stage('Build Shennong Runner') {
            steps {
                dir('shennong_runner') {
                    script {
                        docker.build('ghcr.io/perceptimatic/sfo-shennong-runner:dev')
                    }
                }
            }
        }
        stage('Build schema') {
            steps {
                script {
                    sh './build-schema.sh'
                }
            }
        }
        stage('Test, Build, and Push API') {
            when { changeset 'api/**/*' }
            steps {
                dir('api') {
                    script {
                        docker.build('sfo-api:dev')
                        sh "docker run --entrypoint='' sfo-api:dev black --check app"
                        sh "docker run --entrypoint='' sfo-api:dev pytest"
                        withCredentials([
                            usernamePassword(credentialsId: 'gh-pat', usernameVariable: 'OWNER', passwordVariable: 'PAT')
                        ]) {
                            sh 'echo $PAT | docker login ghcr.io -u $OWNER --password-stdin'
                            sh "docker tag sfo-api:dev ghcr.io/${OWNER}/sfo-api:latest"
                            sh "docker push ghcr.io/${OWNER}/sfo-api:latest"
                        }
                        withCredentials(bindings: [sshUserPrivateKey(credentialsId: 'jenkins-ssh', \
                                             keyFileVariable: 'SSHKEY')]) {
                            sh 'ssh -o StrictHostKeyChecking=no -i $SSHKEY jenkins@$HOST "cd $HOST_PATH; bash deploy-dev.sh api" '
                                             }
                    }
                }
            }
        }

        stage('Test, Build, and Push Worker') {
            when { changeset 'worker/**/*' }
            steps {
                dir('worker') {
                    script {
                        docker.build 'sfo-worker:dev', '--build-arg USER_UID=1001 .'
                        sh "docker run --rm --entrypoint='' sfo-worker:dev black --check app"
                        sh "docker run --entrypoint='' sfo-worker:dev pytest"
                        withCredentials([
                            usernamePassword(credentialsId: 'gh-pat', usernameVariable: 'OWNER', passwordVariable: 'PAT')
                        ]) {
                            sh 'echo $PAT | docker login ghcr.io -u $OWNER --password-stdin'
                            sh "docker tag sfo-worker:dev ghcr.io/${OWNER}/sfo-worker:latest"
                            sh "docker push ghcr.io/${OWNER}/sfo-worker:latest"
                        }
                    }
                }
            }
        }

        stage('Test, (Re)Build, and Push Shennong Runner') {
            when { changeset 'shennong_runner/**/*' }
            steps {
                dir('shennong_runner') {
                    script {
                        docker.build('ghcr.io/perceptimatic/sfo-shennong-runner:dev')
                        sh "docker run --rm --entrypoint='' ghcr.io/perceptimatic/sfo-shennong-runner:dev black --check app"
                        sh "docker run --entrypoint='' ghcr.io/perceptimatic/sfo-shennong-runner:dev pytest"
                        withCredentials([
                            usernamePassword(credentialsId: 'gh-pat', usernameVariable: 'OWNER', passwordVariable: 'PAT')
                        ]) {
                            sh 'echo $PAT | docker login ghcr.io -u $OWNER --password-stdin'
                            sh "docker tag ghcr.io/perceptimatic/sfo-shennong-runner:dev ghcr.io/${OWNER}/sfo-shennong-runner:latest"
                            sh "docker push ghcr.io/${OWNER}/sfo-shennong-runner:latest"
                        }
                    }
                }
            }
        }

        stage('Build React App') {
            when { changeset 'react/**/*' }
            agent {
                docker {
                    image 'node:latest'
                    args '-e AWS_DEFAULT_REGION=$AWS_DEFAULT_REGION \
                          -e BUCKET_NAME=$BUCKET_NAME \
                          -e REACT_TMP_CRED_ENDPOINT=$REACT_TMP_CRED_ENDPOINT \
                          -e STORAGE_DRIVER=$STORAGE_DRIVER'
                }
            }
            steps {
                dir('react') {
                    sh '''
                        yarn
                        yarn run lint-check
                        yarn run format-check
                        yarn run type-check
                        yarn run build
                    '''
                }
            }
        }
        stage('Deploy React') {
            when { changeset 'react/**/*' }
            agent any
            steps {
                withCredentials(bindings: [sshUserPrivateKey(credentialsId: 'jenkins-ssh', \
                    keyFileVariable: 'SSHKEY')]) {
                        sh 'rsync -avh -e "ssh -o StrictHostKeyChecking=no -i $SSHKEY" ./react/dist jenkins@$HOST:$HOST_PATH/react/'
                    }
            }
        }
        stage('Deploy API') {
            when { changeset 'api/**/*' }
            agent any
            steps {
                withCredentials(bindings: [sshUserPrivateKey(credentialsId: 'jenkins-ssh', \
                    keyFileVariable: 'SSHKEY')]) {
                        sh 'ssh -o StrictHostKeyChecking=no -i $SSHKEY jenkins@$HOST "cd $HOST_PATH; bash deploy-dev.sh api" '
                    }
            }
        }
        stage('Deploy worker') {
            when { changeset 'worker/**/*' }
            agent any
            steps {
                withCredentials(bindings: [sshUserPrivateKey(credentialsId: 'jenkins-ssh', \
                    keyFileVariable: 'SSHKEY')]) {
                        sh 'ssh -o StrictHostKeyChecking=no -i $SSHKEY jenkins@$HOST "cd $HOST_PATH; bash deploy-dev.sh worker" '
                    }
            }
        }
    }
}
