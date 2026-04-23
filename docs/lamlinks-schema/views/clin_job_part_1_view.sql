-- dbo.clin_job_part_1_view



/* view clin_job_part_1_view: add view */


/* view clin_job_part_1_view: add view */


/* view clin_job_part_1_view: add view */

/* view clin_job_part_1_view: add view */


/* view clin_job_part_1_view: add view */


/* view clin_job_part_1_view: add view */


/* view clin_job_part_1_view: add view */


/* view clin_job_part_1_view: add view */


/* view clin_job_part_1_view: add view */


/* view clin_job_part_1_view: add view */


/* view clin_job_part_1_view: add view */


/* view clin_job_part_1_view: add view */


/* view clin_job_part_1_view: add view */


/* view clin_job_part_1_view: add view */


/* view clin_job_part_1_view: add view */


/* view clin_job_part_1_view: add view */


/* view clin_job_part_1_view: add view */


/* view clin_job_part_1_view: add view */
CREATE VIEW [dbo].[clin_job_part_1_view]
AS
SELECT     dbo.kab_tab.cnq_11_kab, dbo.kab_tab.mkq_11_kab, dbo.kab_tab.rnq_11_kab, dbo.kab_tab.rlq_11_kab, dbo.kab_tab.rcq_11_kab, dbo.kab_tab.rrq_11_kab, 
                      dbo.kab_tab.roq_11_kab, dbo.kab_tab.snq_15_kab, dbo.kab_tab.slq_15_kab, dbo.kab_tab.srq_15_kab, dbo.kab_tab.soq_15_kab, 
                      dbo.k84_tab.idnk71_k84 AS idnk71_k71, dbo.k85_tab.idnk81_k85 AS idnk81_k81, dbo.kab_tab.idnkab_kab, dbo.job_basic_1_view.idnka8_ka8, 
                      dbo.job_basic_1_view.job_no_ka8, dbo.job_basic_1_view.jln_no_ka9, dbo.job_basic_1_view.jlndte_ka9, dbo.job_basic_1_view.jlnqty_ka9, 
                      dbo.job_basic_1_view.jlnsta_ka9, dbo.job_basic_1_view.jlnsdt_ka9, dbo.job_basic_1_view.idnka9_ka9, dbo.job_basic_1_view.jrqpur_ka9, dbo.k84_tab.sop_um_k84, 
                      dbo.k85_tab.idnk85_k85, dbo.k85_tab.dlydte_k85, dbo.job_basic_1_view.idnkaj_kaj
FROM         dbo.k84_tab INNER JOIN
                      dbo.k85_tab ON dbo.k84_tab.idnk84_k84 = dbo.k85_tab.idnk84_k85 INNER JOIN
                      dbo.kab_tab ON dbo.k85_tab.idnk85_k85 = dbo.kab_tab.idnk85_kab INNER JOIN
                      dbo.job_basic_1_view ON dbo.kab_tab.idnka9_kab = dbo.job_basic_1_view.idnka9_ka9


















