-- dbo.node_job_1_view



/* view node_job_1_view: add view */


/* view node_job_1_view: add view */


/* view node_job_1_view: add view */

/* view node_job_1_view: add view */


/* view node_job_1_view: add view */


/* view node_job_1_view: add view */


/* view node_job_1_view: add view */


/* view node_job_1_view: add view */


/* view node_job_1_view: add view */


/* view node_job_1_view: add view */


/* view node_job_1_view: add view */


/* view node_job_1_view: add view */


/* view node_job_1_view: add view */


/* view node_job_1_view: add view */


/* view node_job_1_view: add view */


/* view node_job_1_view: add view */


/* view node_job_1_view: add view */


/* view node_job_1_view: add view */
CREATE VIEW [dbo].[node_job_1_view]
AS
SELECT     D01_tab.nodeid_d01, D01_tab.nodesc_d01, D02_tab.sysnam_d02, D02_tab.wrknam_d02, D02_tab.wrkfun_d02, D02_tab.wrkprm_d02, D03_tab.jobtyp_d03, 
                      D03_tab.rankno_d03, D03_tab.maxact_d03, D03_tab.autoaf_d03, D01_tab.idnd01_d01, D02_tab.idnd02_d02, D03_tab.idnd03_d03
FROM         dbo.d01_tab AS D01_tab INNER JOIN
                      dbo.d03_tab AS D03_tab ON D01_tab.idnd01_d01 = D03_tab.idnd01_d03 INNER JOIN
                      dbo.d02_tab AS D02_tab ON D03_tab.idnd02_d03 = D02_tab.idnd02_d02


















