import React from 'react';
import { Grid, Link } from '@mui/material';
import { Page } from '../Components';

const AboutPage: React.FC = () => (
    <Page title="About">
        <Grid container direction="column">
            <Grid item>
                Speech Features Online allows users to upload audio files for
                analysis by the{' '}
                <Link href="https://docs.cognitive-ml.fr/shennong/">
                    Shennong
                </Link>{' '}
                feature extraction software. The analysis runs aynchronously on
                a dedicated server, and the results are sent to the email
                address associated with the user's account.
            </Grid>
        </Grid>
    </Page>
);

export default AboutPage;
