-- dbo.inventory_part_clin_use_1_view



/* view inventory_part_clin_use_1_view: add view */


/* view inventory_part_clin_use_1_view: add view */


/* view inventory_part_clin_use_1_view: add view */

/* view inventory_part_clin_use_1_view: add view */


/* view inventory_part_clin_use_1_view: add view */


/* view inventory_part_clin_use_1_view: add view */


/* view inventory_part_clin_use_1_view: add view */


/* view inventory_part_clin_use_1_view: add view */


/* view inventory_part_clin_use_1_view: add view */


/* view inventory_part_clin_use_1_view: add view */


/* view inventory_part_clin_use_1_view: add view */


/* view inventory_part_clin_use_1_view: add view */


/* view inventory_part_clin_use_1_view: add view */


/* view inventory_part_clin_use_1_view: add view */


/* view inventory_part_clin_use_1_view: add view */


/* view inventory_part_clin_use_1_view: add view */


/* view inventory_part_clin_use_1_view: add view */


/* view inventory_part_clin_use_1_view: add view */
CREATE VIEW [dbo].[inventory_part_clin_use_1_view]
AS
SELECT     dbo.inventory_part_1_view.fsc_k08, dbo.inventory_part_1_view.niin_k08, dbo.inventory_part_1_view.prtnum_k71, dbo.inventory_part_1_view.pn_rev_k71, 
                      dbo.inventory_part_1_view.p_desc_k71, dbo.inventory_part_1_view.e_code_mfg, dbo.inventory_part_1_view.e_name_mfg, dbo.inventory_part_1_view.instat_k93, 
                      dbo.inventory_part_1_view.insdte_k93, dbo.inventory_part_1_view.snq_21_k93, dbo.inventory_part_1_view.slq_21_k93, dbo.inventory_part_1_view.soq_21_k93, 
                      dbo.inventory_part_1_view.ictref_kbb, dbo.inventory_part_1_view.addtme_kbb, dbo.inventory_part_1_view.isttbl_k93, dbo.inventory_part_1_view.idnist_k93, 
                      dbo.inventory_part_1_view.locatn_kbc, dbo.inventory_part_1_view.locqty_kbc, dbo.inventory_part_1_view.d_code_whs, dbo.inventory_part_1_view.d_name_whs, 
                      dbo.inventory_part_1_view.idnk08_k08, dbo.inventory_part_1_view.idnk71_k71, dbo.inventory_part_1_view.idnk93_k93, dbo.inventory_part_1_view.idnka7_whs, 
                      dbo.inventory_part_1_view.idnkbb_kbb, dbo.inventory_part_1_view.idnkbc_kbc, dbo.inventory_part_1_view.invsta_k93, dbo.inventory_part_1_view.p_um_k71, 
                      dbo.inventory_part_1_view.locmas_kbc, dbo.ka4_tab.idnka4_ka4, dbo.ka4_tab.uptime_ka4, dbo.ka4_tab.idnk93_ka4, dbo.ka4_tab.idnkak_ka4, dbo.ka4_tab.irutbl_ka4, 
                      dbo.ka4_tab.idniru_ka4, dbo.ka4_tab.postfl_ka4, dbo.ka4_tab.posdte_ka4, dbo.ka4_tab.dspqty_ka4, dbo.ka4_tab.ufsval_ka4, dbo.ka4_tab.ucrval_ka4, 
                      dbo.clin_job_part_1_view.idnk81_k81, dbo.clin_job_part_1_view.idnka9_ka9, dbo.clin_job_part_1_view.job_no_ka8, dbo.clin_job_part_1_view.idnka8_ka8, 
                      dbo.clin_job_part_1_view.jln_no_ka9, dbo.clin_job_part_1_view.jlndte_ka9, dbo.clin_job_part_1_view.jlnsta_ka9, dbo.clin_job_part_1_view.jlnsdt_ka9, 
                      dbo.clin_job_part_1_view.idnkaj_kaj
FROM         dbo.inventory_part_1_view INNER JOIN
                      dbo.ka4_tab ON dbo.inventory_part_1_view.idnk93_k93 = dbo.ka4_tab.idnk93_ka4 INNER JOIN
                      dbo.clin_job_part_1_view ON dbo.ka4_tab.idniru_ka4 = dbo.clin_job_part_1_view.idnkab_kab
WHERE     (dbo.ka4_tab.irutbl_ka4 = 'kab')


















