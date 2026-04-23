-- dbo.inventory_part_clin_use_2_view



/* view inventory_part_clin_use_2_view: add view */


/* view inventory_part_clin_use_2_view: add view */


/* view inventory_part_clin_use_2_view: add view */

/* view inventory_part_clin_use_2_view: add view */


/* view inventory_part_clin_use_2_view: add view */


/* view inventory_part_clin_use_2_view: add view */


/* view inventory_part_clin_use_2_view: add view */


/* view inventory_part_clin_use_2_view: add view */


/* view inventory_part_clin_use_2_view: add view */


/* view inventory_part_clin_use_2_view: add view */
/* view inventory_part_clin_use_2_view: add view 
 view inventory_part_clin_use_2_view: add view 
 view inventory_part_clin_use_2_view: add view 
 view inventory_part_clin_use_2_view: add view 
 view inventory_part_clin_use_2_view: add view 
 view inventory_part_clin_use_2_view: add view 
 view inventory_part_clin_use_2_view: add view 
 view inventory_part_clin_use_2_view: add view */
CREATE VIEW [dbo].[inventory_part_clin_use_2_view]
AS
SELECT        dbo.clin_basic_1_view.cntrct_k79, dbo.clin_basic_1_view.rel_no_k80, dbo.clin_basic_1_view.clinno_k81, dbo.clin_basic_1_view.idnk81_k81, dbo.clin_basic_1_view.idnk80_k80, 
                         dbo.inventory_part_clin_use_1_view.idnka9_ka9, dbo.inventory_part_clin_use_1_view.idnka8_ka8, dbo.inventory_part_clin_use_1_view.idnka4_ka4, dbo.inventory_part_clin_use_1_view.instat_k93, 
                         dbo.inventory_part_clin_use_1_view.idnk93_k93, dbo.inventory_part_clin_use_1_view.posdte_ka4, dbo.inventory_part_clin_use_1_view.postfl_ka4, dbo.inventory_part_clin_use_1_view.dspqty_ka4, 
                         dbo.clin_basic_1_view.idnk79_k79, dbo.inventory_part_clin_use_1_view.fsc_k08, dbo.inventory_part_clin_use_1_view.niin_k08, dbo.inventory_part_clin_use_1_view.pn_rev_k71, 
                         dbo.inventory_part_clin_use_1_view.p_desc_k71, dbo.inventory_part_clin_use_1_view.e_code_mfg, dbo.inventory_part_clin_use_1_view.idnk71_k71, dbo.inventory_part_clin_use_1_view.snq_21_k93, 
                         dbo.inventory_part_clin_use_1_view.job_no_ka8, dbo.inventory_part_clin_use_1_view.jlnsta_ka9, dbo.inventory_part_clin_use_1_view.jlndte_ka9, dbo.inventory_part_clin_use_1_view.jlnsdt_ka9, 
                         dbo.inventory_part_clin_use_1_view.prtnum_k71, dbo.kaj_tab.shpnum_kaj, dbo.inventory_part_clin_use_1_view.idnkaj_kaj, dbo.inventory_part_clin_use_1_view.jln_no_ka9, 
                         dbo.clin_basic_1_view.piidno_k80
FROM            dbo.clin_basic_1_view INNER JOIN
                         dbo.inventory_part_clin_use_1_view ON dbo.clin_basic_1_view.idnk81_k81 = dbo.inventory_part_clin_use_1_view.idnk81_k81 LEFT OUTER JOIN
                         dbo.kaj_tab ON dbo.inventory_part_clin_use_1_view.idnkaj_kaj = dbo.kaj_tab.idnkaj_kaj










