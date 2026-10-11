import '@servicenow/sdk/global'

declare global {
    namespace Now {
        namespace Internal {
            interface Keys extends KeysRegistry {
                explicit: {
                    'aiux-color-swatch|sprint-gov': {
                        table: 'sys_aix_color_swatch'
                        id: '8d6eff7968374e65d4cc354051310bca'
                        deleted: true
                    }
                    'aiux-dependency|icon-directive.js': {
                        table: 'sys_aix_dependency'
                        id: '4e76ad2839990e818f059f6605c1d7c5'
                    }
                    'aiux-dependency|index.js': {
                        table: 'sys_aix_dependency'
                        id: '8b820ae552b76750d492f55cf0bbd970'
                    }
                    'aiux-dependency|tooltip-directive.js': {
                        table: 'sys_aix_dependency'
                        id: 'b7be4fcb5da44c200025bb81dee5a167'
                        deleted: true
                    }
                    'aiux-experience-page-rel|x-snc-sprint-gov-board-page': {
                        table: 'sys_aix_experience_page_rel'
                        id: 'c25983f4384600d21a73083738b3030f'
                    }
                    'aiux-experience-page-rel|x-snc-sprint-gov-home-page': {
                        table: 'sys_aix_experience_page_rel'
                        id: '6cdec6aa8ba9ae5d41bcf3118be48934'
                        deleted: false
                    }
                    'aiux-experience-page-rel|x-snc-sprint-gov-sprint-detail-page': {
                        table: 'sys_aix_experience_page_rel'
                        id: '390f20b4eecb09be57c856fcfe6eea1b'
                    }
                    'aiux-experience-page-rel|x-snc-sprint-gov-sprint-planning-page': {
                        table: 'sys_aix_experience_page_rel'
                        id: '65e53a3723704522670efe0d31582253'
                        deleted: true
                    }
                    'aiux-experience-prop|appHeadCss': {
                        table: 'sys_aix_experience_properties'
                        id: 'fd74836e692994ca29acf3846d9a7a2e'
                    }
                    'aiux-experience-prop|appTailwindCss': {
                        table: 'sys_aix_experience_properties'
                        id: '1e9545bfe9c465be14fde86fd605e8f7'
                    }
                    'aiux-experience|sprint-gov': {
                        table: 'sys_aix_experience'
                        id: '850201af0c6e1ade3882ce73cb3f2975'
                    }
                    'aiux-layout-widget|lifecycle': {
                        table: 'sys_aix_widget'
                        id: '88ece877d7af29577e40a270cde41439'
                    }
                    'aiux-m2m-widget-dep|aiux-agile-board|icon-directive.js': {
                        table: 'sys_aix_m2m_widget_dependency'
                        id: '3613219d691ee4bba875ec51286589af'
                    }
                    'aiux-m2m-widget-dep|aiux-agile-board|tooltip-directive.js': {
                        table: 'sys_aix_m2m_widget_dependency'
                        id: '875ada3aa589fe891f3ede3e90e7ec6e'
                        deleted: true
                    }
                    'aiux-m2m-widget-dep|aiux-sprint-detail|icon-directive.js': {
                        table: 'sys_aix_m2m_widget_dependency'
                        id: '5a0f87c5e6e07d39c84561bb4fc997df'
                    }
                    'aiux-m2m-widget-dep|aiux-sprint-detail|index.js': {
                        table: 'sys_aix_m2m_widget_dependency'
                        id: 'd4176a2328be68aaa601c65b25cb0595'
                    }
                    'aiux-m2m-widget-dep|aiux-sprint-detail|tooltip-directive.js': {
                        table: 'sys_aix_m2m_widget_dependency'
                        id: '87c45edf41cc6ff591be59c790b99ca2'
                        deleted: true
                    }
                    'aiux-m2m-widget-dep|aiux-sprint-management|icon-directive.js': {
                        table: 'sys_aix_m2m_widget_dependency'
                        id: 'a35f11bed86fefa3163af9f1182d127c'
                    }
                    'aiux-m2m-widget-dep|aiux-sprint-management|index.js': {
                        table: 'sys_aix_m2m_widget_dependency'
                        id: '8b5200b59c5304190e8217990d299f59'
                    }
                    'aiux-m2m-widget-dep|aiux-sprint-management|tooltip-directive.js': {
                        table: 'sys_aix_m2m_widget_dependency'
                        id: 'ac576969cc99f42128da0a537fa435a7'
                        deleted: true
                    }
                    'aiux-page-widget|x-snc-sprint-gov-board-page': {
                        table: 'sys_aix_widget'
                        id: 'fccfb440418f1fbaa4700e393a7c238e'
                    }
                    'aiux-page-widget|x-snc-sprint-gov-home-page': {
                        table: 'sys_aix_widget'
                        id: 'bfb8ecf11cbb27596b109261f58b3853'
                        deleted: false
                    }
                    'aiux-page-widget|x-snc-sprint-gov-sprint-detail-page': {
                        table: 'sys_aix_widget'
                        id: '8ca6a25055c6512972ca08e66714e9e9'
                    }
                    'aiux-page-widget|x-snc-sprint-gov-sprint-planning-page': {
                        table: 'sys_aix_widget'
                        id: '408d900b7e79a35a7bd80eb88163f842'
                        deleted: true
                    }
                    'aiux-page|x-snc-sprint-gov-board-page': {
                        table: 'sys_aix_page'
                        id: 'a2488680dee3593609ada47e43b48ca8'
                    }
                    'aiux-page|x-snc-sprint-gov-home-page': {
                        table: 'sys_aix_page'
                        id: '4fddcabedaf7f3296a75fab6466ddc78'
                        deleted: false
                    }
                    'aiux-page|x-snc-sprint-gov-sprint-detail-page': {
                        table: 'sys_aix_page'
                        id: 'ad978d1be922f607217507248bb421a4'
                    }
                    'aiux-page|x-snc-sprint-gov-sprint-planning-page': {
                        table: 'sys_aix_page'
                        id: '367421891ec7d32e5190f27ceba498b9'
                        deleted: true
                    }
                    'aiux-project|x_snc_sprint_gov': {
                        table: 'sys_aix_project'
                        id: '0f21a298e0fcf8e45dde12b5dbf72cdb'
                    }
                    'aiux-theme|sprint-gov': {
                        table: 'sys_aix_theme'
                        id: '39182a1cb7f0f3e43d7af4abb753a782'
                    }
                    'aiux-widget|aiux-agile-board': {
                        table: 'sys_aix_widget'
                        id: 'c2a86b1bdc8cf090c68529293724cfd6'
                    }
                    'aiux-widget|aiux-hello-world': {
                        table: 'sys_aix_widget'
                        id: '5f26c8896c469d5d372916fdafd68bbf'
                        deleted: true
                    }
                    'aiux-widget|aiux-sprint-detail': {
                        table: 'sys_aix_widget'
                        id: 'fd23d0398e21df81fc2ebf293ab83460'
                    }
                    'aiux-widget|aiux-sprint-management': {
                        table: 'sys_aix_widget'
                        id: 'ae398c3f68d63bcb0d9ddfde3d28811e'
                    }
                    'aiux-widget|aiux-studio-preview': {
                        table: 'sys_aix_widget'
                        id: 'b964ea49960ce70b3909518d7f65b75b'
                    }
                    bom_json: {
                        table: 'sys_module'
                        id: '8657655d9ef94a0e92c05f10cee30d0d'
                    }
                    package_json: {
                        table: 'sys_module'
                        id: '1d724d6a07824d3089907d23531645c3'
                    }
                }
                composite: [
                    {
                        table: 'sn_glider_source_artifact'
                        id: '066bf9288339446388dec6aeec37b632'
                        key: {
                            name: 'aiux-source 0f21a298e0fcf8e45dde12b5dbf72cdb'
                        }
                    },
                    {
                        table: 'sn_glider_source_artifact_m2m'
                        id: '3461642f558e474c8b4ce1b65a7a3acc'
                        key: {
                            application_file: '0f21a298e0fcf8e45dde12b5dbf72cdb'
                            source_artifact: '066bf9288339446388dec6aeec37b632'
                        }
                    },
                ]
            }
        }
    }
}
