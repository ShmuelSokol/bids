-- dbo.bot_job_1_view



/* view bot_job_1_view: add view */


/* view bot_job_1_view: add view */


/* view bot_job_1_view: add view */

/* view bot_job_1_view: add view */


/* view bot_job_1_view: add view */


/* view bot_job_1_view: add view */


/* view bot_job_1_view: add view */


/* view bot_job_1_view: add view */


/* view bot_job_1_view: add view */
/* view bot_job_1_view: add view */
CREATE VIEW [dbo].[bot_job_1_view]
AS
SELECT DISTINCT 
                         dbo.k23_tab.sacnam_k23, dbo.k23_tab.sacdes_k23, dbo.k23_tab.sactyp_k23, dbo.k27_tab.ssatyp_k27, dbo.k28_tab.ssadds_k28, dbo.k28_tab.jobcnt_k28, dbo.k28_tab.jobtot_k28, dbo.k28_tab.jobstt_k28, 
                         dbo.k23_tab.idnk23_k23, dbo.k27_tab.idnk27_k27, dbo.k28_tab.idnk27_k28, dbo.k28_tab.idnk28_k28, dbo.k28_tab.srqtyp_k28, dbo.k28_tab.idnsrq_k28
FROM            dbo.k28_tab INNER JOIN
                         dbo.k27_tab ON dbo.k28_tab.idnk27_k28 = dbo.k27_tab.idnk27_k27 INNER JOIN
                         dbo.k23_tab ON dbo.k27_tab.idnk23_k27 = dbo.k23_tab.idnk23_k23









