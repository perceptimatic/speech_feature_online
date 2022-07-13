import React from 'react';
import { Link as RouterLink, LinkProps } from 'react-router-dom';
import { Link as MuiLink } from '@mui/material';

// https://mui.com/guides/routing/#global-theme-link
/* eslint-disable-next-line react/display-name */
const LinkBehavior = React.forwardRef<
    any,
    Omit<LinkProps, 'to'> & {
        href: LinkProps['to'];
    }
>((props, ref) => {
    const { href, ...other } = props;
    // Map href (MUI) -> to (react-router)
    return <RouterLink ref={ref} to={href} {...other} />;
});

export const MenuLink: React.FC<{ href: string; onClick?: () => void }> = ({
    children,
    href,
    onClick,
}) => (
    <MuiLink
        sx={theme => ({
            color: theme.palette.primary.contrastText,
        })}
        href={href}
        component={LinkBehavior}
        onClick={onClick}
    >
        {children}
    </MuiLink>
);
