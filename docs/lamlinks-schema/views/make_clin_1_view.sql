-- dbo.make_clin_1_view



/* view make_clin_1_view: add view */


/* view make_clin_1_view: add view */


/* view make_clin_1_view: add view */

/* view make_clin_1_view: add view */


/* view make_clin_1_view: add view */


/* view make_clin_1_view: add view */


/* view make_clin_1_view: add view */


/* view make_clin_1_view: add view */


/* view make_clin_1_view: add view */


/* view make_clin_1_view: add view */
/* view make_clin_1_view: add view 
 view make_clin_1_view: add view 
 view make_clin_1_view: add view 
 view make_clin_1_view: add view 
 view make_clin_1_view: add view 
 view make_clin_1_view: add view 
 view make_clin_1_view: add view 
 view make_clin_1_view: add view */
CREATE VIEW [dbo].[make_clin_1_view]
AS
SELECT        dbo.clin_basic_1_view.cntrct_k79, dbo.clin_basic_1_view.rel_no_k80, dbo.clin_basic_1_view.clinno_k81, dbo.clin_basic_1_view.cage_k13 AS e_code_mfg, dbo.clin_basic_1_view.prtnum_k71, 
                         dbo.clin_basic_1_view.pn_rev_k71, dbo.clin_basic_1_view.p_desc_k71, dbo.clin_basic_1_view.fsc_k08, dbo.clin_basic_1_view.niin_k08, dbo.bom_project_view_1.prjnam_k73, 
                         dbo.bom_project_view_1.bv_num_kd2, dbo.bom_project_view_1.bvstat_kd2, dbo.clin_basic_1_view.idnk08_k08, dbo.clin_basic_1_view.idnk71_k71, dbo.clin_basic_1_view.idnk81_k81, 
                         dbo.bom_project_view_1.idnk73_k73, dbo.kau_tab.idnkau_kau, dbo.clin_basic_1_view.idnk79_k79, dbo.kau_tab.adddte_kau, dbo.clin_basic_1_view.clnqty_k81, dbo.clin_basic_1_view.reqdly_k81, 
                         dbo.clin_basic_1_view.piidno_k80
FROM            dbo.clin_basic_1_view INNER JOIN
                         dbo.kau_tab ON dbo.clin_basic_1_view.idnk81_k81 = dbo.kau_tab.idngx1_kau AND dbo.kau_tab.gx1tbl_kau = 'k81' INNER JOIN
                         dbo.bom_project_view_1 ON dbo.kau_tab.idngx2_kau = dbo.bom_project_view_1.idnk73_k73 AND dbo.kau_tab.gx1tbl_kau = 'k81' AND dbo.kau_tab.gx2tbl_kau = 'k73'










