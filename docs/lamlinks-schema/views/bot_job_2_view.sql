-- dbo.bot_job_2_view



/* view bot_job_2_view: add view */


/* view bot_job_2_view: add view */


/* view bot_job_2_view: add view */

/* view bot_job_2_view: add view */


/* view bot_job_2_view: add view */


/* view bot_job_2_view: add view */


/* view bot_job_2_view: add view */


/* view bot_job_2_view: add view */


/* view bot_job_2_view: add view */
CREATE VIEW [dbo].[bot_job_2_view]
AS
SELECT        dbo.bot_job_1_view.sactyp_k23, dbo.bot_job_1_view.ssatyp_k27, dbo.k10_tab.sol_no_k10, dbo.bot_job_1_view.ssadds_k28, dbo.bot_job_1_view.jobtot_k28, dbo.bot_job_1_view.jobcnt_k28, 
                         dbo.bot_job_1_view.jobstt_k28, dbo.k08_tab.idnk08_k08, dbo.k10_tab.idnk10_k10, dbo.k11_tab.idnk11_k11, dbo.bot_job_1_view.idnk23_k23, dbo.bot_job_1_view.idnk28_k28, 
                         dbo.bot_job_1_view.idnk27_k28
FROM            dbo.k08_tab INNER JOIN
                         dbo.k11_tab ON dbo.k08_tab.idnk08_k08 = dbo.k11_tab.idnk08_k11 INNER JOIN
                         dbo.bot_job_1_view ON dbo.k11_tab.idnk11_k11 = dbo.bot_job_1_view.idnsrq_k28 INNER JOIN
                         dbo.k10_tab ON dbo.k11_tab.idnk10_k11 = dbo.k10_tab.idnk10_k10
WHERE        (dbo.bot_job_1_view.srqtyp_k28 = 'k11')









